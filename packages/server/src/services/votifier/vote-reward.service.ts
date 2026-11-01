import { Q } from "@/db";
import type { PlaytimeManagerService } from "@/services/playtime/playtime-manager.service";
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
}

const DEFAULT_SWEEP_INTERVAL_MS = 5 * 60 * 1000;
const COMMAND_FAILED =
  /no player was found|player does not exist|unknown item|cannot give/i;

function billCommand(username: string): string {
  return `give ${username} createringtoncurrency:bill_10 1`;
}

function xpCommand(username: string): string {
  return `xp add ${username} 500 points`;
}

function thanksCommand(username: string, count: number): string {
  const text =
    count === 1
      ? "Thanks for voting! Your reward is in your inventory."
      : `Thanks for voting ${count} times! Your rewards are in your inventory.`;
  return `tellraw ${username} ${JSON.stringify({ text, color: "gold" })}`;
}

/**
 * Vote Reward Service
 *
 * Pays out stored server-list votes in game, over RCON, the next time the
 * voter is online on a reward server: the session start of every tracked
 * reward server (present and brought up later) triggers a payout for that
 * player, and a periodic sweep pays online players whose votes are still
 * pending (a join the app missed, RCON down at the time). Sessions on other
 * servers, such as a synced test server, pay nothing. Every vote gives the
 * same bill and XP the Votifier mod used to give, followed by one private
 * thank-you per batch. The vote is claimed (`rewarded_at` set) before the
 * bill is given and the claim is reverted when the bill fails, so the
 * service fails toward a vote that is stamped but unpaid, which is visible
 * in `reward_error` and the log, never toward a second bill. A failed XP
 * command after the bill is noted in `reward_error` and not retried.
 * Payouts for one player never run concurrently.
 */
export class VoteRewardService {
  private sweepTimer: NodeJS.Timeout | null = null;
  private readonly inFlight = new Set<string>();
  private readonly rewardServerIds: Set<number>;

  constructor(
    private readonly playtimeManager: PlaytimeManagerService,
    private readonly send: RconSend = defaultRconSend,
    private readonly options: VoteRewardServiceOptions = {},
  ) {
    this.rewardServerIds = new Set(options.rewardServerIds ?? []);
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

    const username = requireUsername(rawUsername);
    let paid = 0;

    for (const vote of pending) {
      await Q.player.vote.update(
        { id: vote.id },
        { rewardedAt: new Date(), rewardError: null },
      );

      const billFailure = await this.run(serverId, billCommand(username));
      if (billFailure) {
        await this.revertClaim(vote.id, username, billFailure);
        break;
      }
      paid++;

      const xpFailure = await this.run(serverId, xpCommand(username));
      if (xpFailure) {
        await Q.player.vote.update({ id: vote.id }, { rewardError: xpFailure });
        logger.warn(
          `Vote #${vote.id} for ${username} was paid without its XP: ${xpFailure}`,
        );
        break;
      }
    }

    if (paid === 0) return;
    logger.info(
      `Paid ${paid} vote reward(s) to ${username} on server ${serverId}`,
    );
    try {
      await this.send(serverId, thanksCommand(username, paid));
    } catch (error) {
      logger.warn(`Could not thank ${username} for voting: ${error}`);
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
        `Vote #${voteId} for ${username} is stamped as paid but its bill was not given (${failure}) and the stamp could not be reverted:`,
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
