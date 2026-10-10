import config from "@/config";
import { Discord } from "@/discord/constants";
import { buildComponentsMessage, ComponentPresets } from "@/discord/components";
import {
  readAppChangelog,
  summarizeRelease,
  type ReleaseSummary,
} from "@/services/app-changelog";
import { settings } from "@/services/settings";

const RELEASE_VERSION = /^\d+\.\d+\.\d+$/;

/**
 * Posts a notice to the admin notifications channel when the running app
 * version is not the one announced last (kept in app_setting), so every
 * release is announced once and a plain restart stays silent. Meant to be
 * called once after startup. A no-op outside the production deployment and
 * for anything that is not a plain release version (dev builds, "unknown").
 * A failed post leaves the stored version untouched, so the next start tries
 * again.
 */
export class ReleaseAnnouncementService {
  /** Announce the running version unless it was announced already; never throws. */
  async announceIfNew(): Promise<void> {
    if (!config.envMode.isProd || config.envMode.isDevDeployment) return;

    const version = config.app.version;
    if (!RELEASE_VERSION.test(version)) return;

    try {
      if ((await settings.getAnnouncedAppVersion()) === version) return;

      const summary = await this.readSummary(version);
      const message = buildComponentsMessage(
        ComponentPresets.appRelease.live({
          version,
          summary,
          changelogUrl: this.changelogUrl(summary ? version : null),
        }),
      );

      const result = await Discord.Messages.send({
        channelId: Discord.Channels.administration.NOTIFICATIONS,
        components: message.components,
        flags: message.flags,
        allowedMentions: { parse: [] },
      });

      if (!result.success) {
        logger.error(
          `Failed to announce app release v${version}: ${result.error}`,
        );
        return;
      }

      await settings.setAnnouncedAppVersion(version);
      logger.info(`Announced app release v${version}`);
    } catch (error) {
      logger.error(`Failed to announce app release v${version}:`, error);
    }
  }

  private async readSummary(version: string): Promise<ReleaseSummary | null> {
    try {
      return summarizeRelease(await readAppChangelog(), version);
    } catch (error) {
      logger.warn("Failed to read CHANGELOG.md for the release notice:", error);
      return null;
    }
  }

  private changelogUrl(version: string | null): string {
    const base = `${config.meta.links.website.replace(/\/+$/, "")}/admin/changelog`;
    return version ? `${base}#v${version}` : base;
  }
}

export const releaseAnnouncementService = new ReleaseAnnouncementService();
