import { Q } from "@/db";
import type { PlaytimeManagerService } from "@/services/playtime/playtime-manager.service";
import { settings, type VoteRewardCommands } from "@/services/settings";
import {
  defaultRconSend,
  isUnknownCommand,
  requireUsername,
  stripFormatting,
  type RconSend,
} from "@/utils/rcon";

export interface VoteRewardServiceOptions {
  rewardServerIds?: number[];
  sweepIntervalMs?: number;
  commands?: () => Promise<VoteRewardCommands>;
}

const DEFAULT_SWEEP_INTERVAL_MS = 5 * 60 * 1000;
const COMMAND_FAILED =
  /no player was found|player does not exist|unknown item|cannot give/i;

function fill(
  template: string,
  values: Record<string, string | number>,
): string {
  let command = template.trim().replace(/^\//, "");
  for (const [name, value] of Object.entries(values)) {
    command = command.split(`{${name}}`).join(String(value));
  }
  return command;
}

/**
 * Vote Reward Service
 *
 * Pays out stored server-list votes in game, over RCON, the next time the
 * voter is online on a reward server: the session start of every tracked
 * reward server (present and brought up later) triggers a payout for that
 * player, and a periodic sweep pays online players whose votes are still
 * pending (a join the app missed, RCON down at the time). Sessions on other
 * servers, such as a synced test server, pay nothing. The commands come from
 * the `vote_reward_commands` setting, read at the start of every payout:
 * the `perVote` list runs once per vote and the `afterPayout` list once per
 * batch, with `{player}` (and `{count}` after the payout) filled in. The
 * first per-vote command is the commit point: the vote is claimed
 * (`rewarded_at` set) before it runs and the claim is reverted when it
 * fails, so the service fails toward a vote that is stamped but unpaid,
 * which is visible in `reward_error` and the log, never toward a repeated
 * reward. A later per-vote command that fails is noted in `reward_error`
 * and not retried. Payouts for one player never run concurrently.
 */
export class VoteRewardService {
  private sweepTimer: NodeJS.Timeout | null = null;
  private readonly inFlight = new Set<string>();
  private readonly rewardServerIds: Set<number>;
  private readonly commands: () => Promise<VoteRewardCommands>;

  constructor(
    private readonly playtimeManager: PlaytimeManagerService,
    private readonly send: RconSend = defaultRconSend,
    private readonly options: VoteRewardServiceOptions = {},
  ) {
    this.rewardServerIds = new Set(options.rewardServerIds ?? []);
    this.commands =
      options.commands ?? (() => settings.getVoteRewardCommands());
  }

  /** Subscribes to session starts on every reward server and starts the sweep. */
  async initialize(): Promise<void> {
    this.playtimeManager.onServiceCreated((serverId, service) => {
      if (!this.rewardServerIds.has(serverId)) return;
      service.on("sessionStart", (event) => {
        void this.payout(event.uuid, event.username, serverId);
      });
    });
    this.sweepTimer = setInterval(
      () => void this.sweep(),
      this.options.sweepIntervalMs ?? DEFAULT_SWEEP_INTERVAL_MS,
    );
    logger.info(
      `Vote reward service initialized for server(s) ${[...this.rewardServerIds].join(", ") || "none"}`,
    );
  }

  /** Stops the sweep; a payout in progress finishes on its own. */
  async shutdown(): Promise<void> {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
  }

  /** Pays the pending votes of every player online on a reward server; never throws. */
  async sweep(): Promise<void> {
    try {
      const pending = await Q.player.vote.getPendingPlayerUuids();
      if (pending.length === 0) return;

      const online = await Q.player.findAll({
        minecraftUuid: { $in: pending },
        online: true,
      });
      for (const player of online) {
        if (player.currentServerId === null) continue;
        await this.payout(
          player.minecraftUuid,
          player.minecraftUsername,
          player.currentServerId,
        );
      }
    } catch (error) {
      logger.error("Vote reward sweep failed:", error);
    }
  }

  /** Pays every pending vote of one player on the reward server they are on; never throws. */
  async payout(
    playerMinecraftUuid: string,
    username: string,
    serverId: number,
  ): Promise<void> {
    if (!this.rewardServerIds.has(serverId)) return;
    if (this.inFlight.has(playerMinecraftUuid)) return;
    this.inFlight.add(playerMinecraftUuid);
    try {
      await this.payPending(playerMinecraftUuid, username, serverId);
    } catch (error) {
      logger.error(`Vote payout for ${username} failed:`, error);
    } finally {
      this.inFlight.delete(playerMinecraftUuid);
    }
  }

  private async payPending(
    playerMinecraftUuid: string,
    rawUsername: string,
    serverId: number,
  ): Promise<void> {
    const pending = await Q.player.vote.getPending(playerMinecraftUuid);
    if (pending.length === 0) return;

    const player = requireUsername(rawUsername);
    const { perVote, afterPayout } = await this.commands();
    const [commit, ...rest] = perVote.map((template) =>
      fill(template, { player }),
    );
    let paid = 0;

    votes: for (const vote of pending) {
      await Q.player.vote.update(
        { id: vote.id },
        { rewardedAt: new Date(), rewardError: null },
      );

      const commitFailure = await this.run(serverId, commit);
      if (commitFailure) {
        await this.revertClaim(vote.id, player, commitFailure);
        break;
      }
      paid++;

      for (const command of rest) {
        const failure = await this.run(serverId, command);
        if (failure) {
          await Q.player.vote.update({ id: vote.id }, { rewardError: failure });
          logger.warn(
            `Vote #${vote.id} for ${player} was paid without all its rewards: ${failure}`,
          );
          break votes;
        }
      }
    }

    if (paid === 0) return;
    logger.info(
      `Paid ${paid} vote reward(s) to ${player} on server ${serverId}`,
    );
    for (const template of afterPayout) {
      const command = fill(template, { player, count: paid });
      try {
        await this.send(serverId, command);
      } catch (error) {
        logger.warn(`After-payout command for ${player} failed: ${error}`);
      }
    }
  }

  private async revertClaim(
    voteId: number,
    username: string,
    failure: string,
  ): Promise<void> {
    try {
      await Q.player.vote.update(
        { id: voteId },
        { rewardedAt: null, rewardError: failure },
      );
      logger.warn(`Vote #${voteId} for ${username} stays pending: ${failure}`);
    } catch (error) {
      logger.error(
        `Vote #${voteId} for ${username} is stamped as paid but its first reward was not given (${failure}) and the stamp could not be reverted:`,
        error,
      );
    }
  }

  private async run(serverId: number, command: string): Promise<string | null> {
    let response: string;
    try {
      response = stripFormatting(await this.send(serverId, command));
    } catch (error) {
      return `${command}: ${error instanceof Error ? error.message : error}`;
    }
    if (isUnknownCommand(response) || COMMAND_FAILED.test(response)) {
      return `${command}: ${response}`;
    }
    return null;
  }
}
