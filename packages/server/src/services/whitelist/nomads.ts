import { Rcon } from "rcon-client";
import config from "@/config";
import { Discord } from "@/discord/constants";
import { EmbedColors } from "@/discord/embeds/colors";
import { createEmbed } from "@/discord/embeds/embed-builder";
import { WhitelistAction } from "@/utils/rcon";

const RCON_TIMEOUT_MS = 10_000;

type NomadsWhitelistAction = WhitelistAction.ADD | WhitelistAction.REMOVE;

interface NomadsRconConfig {
  host: string;
  port: number;
  password: string;
}

/**
 * Nomads whitelist automation: a deliberately isolated, best-effort side channel
 * that mirrors player registrations and deletions onto the Nomads server's
 * whitelist over RCON. It self-disables outside the real production deployment
 * or when any RCON env var is missing, opens a short-lived connection per call,
 * and never throws. A failure is logged and surfaced to the admin notifications
 * channel so the triggering flow (registration, deletion) always completes.
 */
function resolveRconConfig(): NomadsRconConfig | null {
  if (!config.envMode.isProd || config.envMode.isDevDeployment) return null;

  const { host, port, password } = config.servers.nomads.rcon;
  if (!host || !port || !password) return null;

  return { host, port, password };
}

async function sendWhitelistCommand(
  action: NomadsWhitelistAction,
  playerName: string,
  rconConfig: NomadsRconConfig,
): Promise<void> {
  const rcon = await Rcon.connect({ ...rconConfig, timeout: RCON_TIMEOUT_MS });
  try {
    const response = await rcon.send(`whitelist ${action} ${playerName}`);
    logger.info(
      `[Nomads] whitelist ${action} ${playerName}: ${response.trim()}`,
    );
  } finally {
    await rcon.end().catch(() => {});
  }
}

async function notifyAdmins(
  action: NomadsWhitelistAction,
  playerName: string,
  error: unknown,
): Promise<void> {
  const reason = error instanceof Error ? error.message : String(error);
  const preposition = action === WhitelistAction.ADD ? "to" : "from";

  const embed = createEmbed()
    .title("⚠️ Nomads whitelist sync failed")
    .description(
      `Could not ${action} **${playerName}** ${preposition} the Nomads whitelist. The triggering action completed normally; only the Nomads server is out of sync.`,
    )
    .field("Player", `\`${playerName}\``, true)
    .field("Action", `whitelist ${action}`, true)
    .field("Error", reason, false)
    .color(EmbedColors.Error)
    .timestamp();

  try {
    await Discord.Messages.send({
      channelId: Discord.Channels.administration.NOTIFICATIONS,
      embeds: embed.build(),
      content: Discord.Roles.mention(Discord.Roles.ADMIN),
    });
  } catch (notifyError) {
    logger.error(
      "[Nomads] Failed to send whitelist failure notification:",
      notifyError,
    );
  }
}

async function run(
  action: NomadsWhitelistAction,
  playerName: string,
): Promise<void> {
  const rconConfig = resolveRconConfig();
  if (!rconConfig) return;

  try {
    await sendWhitelistCommand(action, playerName, rconConfig);
  } catch (error) {
    logger.error(
      `[Nomads] whitelist ${action} failed for ${playerName}:`,
      error,
    );
    await notifyAdmins(action, playerName, error);
  }
}

export const nomadsWhitelist = {
  /** Best-effort add to the Nomads whitelist. Resolves even on failure. */
  add: (playerName: string): Promise<void> =>
    run(WhitelistAction.ADD, playerName),
  /** Best-effort remove from the Nomads whitelist. Resolves even on failure. */
  remove: (playerName: string): Promise<void> =>
    run(WhitelistAction.REMOVE, playerName),
};
