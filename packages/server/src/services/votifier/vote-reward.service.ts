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
  sweepIntervalMs?: number;
}

const DEFAULT_SWEEP_INTERVAL_MS = 5 * 60 * 1000;
const COMMAND_FAILED =
  /no player was found|player does not exist|unknown item|cannot give|incorrect argument/i;

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
 * voter is online: the session start of every tracked server triggers a
 * payout for that player, and a periodic sweep pays online players whose
 * votes are still pending (a join the app missed, RCON down at the time).
 * Every vote gives the same bill and XP the Votifier mod used to give,
 * followed by one private thank-you per batch. The bill is the commit
 * point: a vote is stamped `rewarded_at` as soon as the bill was given, so a
 * retry can never hand out a second bill; a failed XP command afterwards is
 * noted in `reward_error` and not retried. A failed bill records
 * `reward_error` and leaves the vote pending for the next attempt. Payouts
 * for one player never run concurrently, so a join and a sweep cannot pay a
 * vote twice.
 */
export class VoteRewardService {
  private sweepTimer: NodeJS.Timeout | null = null;
  private readonly inFlight = new Set<string>();

  constructor(
    private readonly playtimeManager: PlaytimeManagerService,
    private readonly send: RconSend = defaultRconSend,
    private readonly options: VoteRewardServiceOptions = {},
  ) {}

  /** Subscribes to session starts on every tracked server and starts the sweep. */
  async initialize(): Promise<void> {
    for (const [serverId, service] of this.playtimeManager.getAllServices()) {
      service.on("sessionStart", (event) => {
        void this.payout(event.uuid, event.username, serverId);
      });
    }
    this.sweepTimer = setInterval(
      () => void this.sweep(),
      this.options.sweepIntervalMs ?? DEFAULT_SWEEP_INTERVAL_MS,
    );
    logger.info("Vote reward service initialized");
  }

  /** Stops the sweep; a payout in progress finishes on its own. */
  async shutdown(): Promise<void> {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
  }

  /** Pays the pending votes of every online player that has some; never throws. */
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

  /** Pays every pending vote of one player on the server they are on; never throws. */
  async payout(
    playerMinecraftUuid: string,
    username: string,
    serverId: number,
  ): Promise<void> {
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
      const billFailure = await this.run(serverId, billCommand(username));
      if (billFailure) {
        await Q.player.vote.update(
          { id: vote.id },
          { rewardError: billFailure },
        );
        logger.warn(
          `Vote #${vote.id} for ${username} stays pending: ${billFailure}`,
        );
        break;
      }

      await Q.player.vote.update(
        { id: vote.id },
        { rewardedAt: new Date(), rewardError: null },
      );
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
