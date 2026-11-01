import { Q } from "@/db";
import { escapeLike } from "@/db/utils";
import type { DiscordMessageService } from "@/services/discord/message/message.service";
import { MINECRAFT_USERNAME } from "@/utils/rcon";
import type { VotifierVote } from "./protocol";

export type MessageServiceProvider = () => DiscordMessageService | null;

/**
 * Vote Intake
 *
 * Turns a verified Votifier vote into a `player_vote` row and a shout-out in
 * the server chat channel. The username is matched to a registered player
 * case-insensitively; votes for unknown usernames are stored unlinked (and
 * linked by registration) but announced only for registered players, so the
 * chat cannot be used as a billboard through the vote site. A redelivery of a
 * stored vote is dropped quietly. The message service is looked up per vote
 * and may be absent while the Discord bot is not logged in: the vote is then
 * stored without the shout-out, because storing it is what must not fail.
 */
export class VoteIntake {
  constructor(
    private readonly messageService: MessageServiceProvider,
    private readonly channelId: string,
  ) {}

  /** Stores the vote and announces it when the voter is a registered player. */
  async accept(vote: VotifierVote): Promise<void> {
    const username = vote.username.trim();
    if (!MINECRAFT_USERNAME.test(username)) {
      logger.warn(
        `Votifier: ignored a vote from ${vote.serviceName} for an invalid username ${JSON.stringify(vote.username)}`,
      );
      return;
    }

    const [player] = await Q.player.findAll(
      { minecraftUsername: { $ilike: escapeLike(username) } },
      { limit: 1 },
    );
    const stored = await Q.player.vote.record({
      username,
      serviceName: vote.serviceName,
      votedAt: vote.timestamp ?? new Date(),
      playerMinecraftUuid: player?.minecraftUuid ?? null,
    });

    if (!stored) {
      logger.info(
        `Votifier: dropped a redelivered vote for ${username} from ${vote.serviceName}`,
      );
      return;
    }

    logger.info(
      `Votifier: recorded vote #${stored.id} for ${username} from ${vote.serviceName}` +
        (player ? "" : " (no registered player yet)"),
    );

    if (player) {
      await this.announce(player.minecraftUsername, vote.serviceName);
    }
  }

  private async announce(
    minecraftUsername: string,
    serviceName: string,
  ): Promise<void> {
    const messageService = this.messageService();
    if (!messageService) {
      logger.warn(
        `Votifier: the vote of ${minecraftUsername} was not announced, the Discord bot is not ready`,
      );
      return;
    }
    const result = await messageService.send({
      channelId: this.channelId,
      content: `**${minecraftUsername}** voted for the server on ${serviceName}!`,
    });
    if (!result.success) {
      logger.warn(
        `Votifier: could not announce the vote of ${minecraftUsername}: ${result.error}`,
      );
    }
  }
}
