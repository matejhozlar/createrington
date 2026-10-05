import { AppError } from "@/app/middleware/error-handler";
import config from "@/config";
import { Q } from "@/db";
import { UniqueViolationError } from "@/db/utils";
import {
  LAUNCHER_PLATFORMS,
  type LauncherChannel,
  type LauncherPlatform,
} from "@createrington/shared/launcher";
import type { LauncherRelease } from "@createrington/shared/db/launcher_release.types";
import {
  isDownloadUrlAllowed,
  isNewerVersion,
  isValidVersion,
  newestFirst,
  newestVersion,
} from "./release-rules";
import { parseStructuredNotes } from "./structured-notes";

const DOWNLOAD_CHECK_TIMEOUT_MS = 5000;
const RELEASED_TTL_MS = 60 * 1000;

export type LauncherReleaseErrorCode =
  | "CHANNEL_MISMATCH"
  | "INVALID_VERSION"
  | "HOST_NOT_ALLOWED"
  | "DOWNLOAD_UNREACHABLE"
  | "DUPLICATE_VERSION"
  | "NOT_NEWER"
  | "NOT_FOUND"
  | "INVALID_STATE";

const ERROR_STATUS: Record<LauncherReleaseErrorCode, number> = {
  CHANNEL_MISMATCH: 400,
  INVALID_VERSION: 400,
  HOST_NOT_ALLOWED: 400,
  DOWNLOAD_UNREACHABLE: 400,
  DUPLICATE_VERSION: 409,
  NOT_NEWER: 409,
  NOT_FOUND: 404,
  INVALID_STATE: 409,
};

/** Thrown when a launcher release operation is refused; `code` says why. */
export class LauncherReleaseError extends AppError {
  constructor(code: LauncherReleaseErrorCode, message: string) {
    super(message, ERROR_STATUS[code], true, undefined, { code });
    this.name = "LauncherReleaseError";
  }
}

export interface PublishLauncherReleaseInput {
  channel: LauncherChannel;
  version: string;
  platform: LauncherPlatform;
  url: string;
  signature: string;
  notes: string;
  structuredNotes?: unknown;
  pubDate: Date;
}

export interface LauncherUpdate {
  version: string;
  notes: string;
  pub_date: string;
  url: string;
  signature: string;
  /** True when the launcher that asked is older than a released version marked as required. */
  required: boolean;
}

interface ReleasedVersions {
  newest: LauncherRelease | null;
  minimumVersion: string | null;
}

/**
 * Keeps the list of launcher versions for this environment's channel and answers the
 * launcher's update check. A release build publishes a version as pending, and it is only
 * offered to launchers after the owner released it; a withdrawn version is never offered
 * again. A version can be released as required: the newest released required version of a
 * platform is the oldest launcher the app still serves. The app stores the description of a
 * release, never the installer or a signing key. The newest released version and that
 * minimum are cached per platform in memory for a minute and dropped on every release and
 * withdraw. Singleton.
 */
class LauncherReleaseService {
  private static instance: LauncherReleaseService;

  private readonly released = new Map<
    string,
    ReleasedVersions & { expiresAt: number }
  >();

  static getInstance(): LauncherReleaseService {
    if (!LauncherReleaseService.instance) {
      LauncherReleaseService.instance = new LauncherReleaseService();
    }
    return LauncherReleaseService.instance;
  }

  /** True when `LAUNCHER_PUBLISH_TOKEN_HASH` is configured and versions can be published. */
  isEnabled(): boolean {
    return config.launcher.publishTokenHash.length > 0;
  }

  /**
   * Stores a new version as pending. Throws `LauncherReleaseError` when the channel is not
   * this environment's, the download host is not allowed or does not answer, or the version
   * is already stored or not newer than every stored one (in any state). Structured notes
   * that cannot be read are dropped with a warning, the release is stored with its text.
   */
  async publish(input: PublishLauncherReleaseInput): Promise<LauncherRelease> {
    if (input.channel !== config.launcher.channel) {
      throw new LauncherReleaseError(
        "CHANNEL_MISMATCH",
        `This environment serves the ${config.launcher.channel} channel`,
      );
    }

    if (!isValidVersion(input.version)) {
      throw new LauncherReleaseError(
        "INVALID_VERSION",
        "Version is not a valid semantic version",
      );
    }

    if (!isDownloadUrlAllowed(input.url, config.launcher.downloadHosts)) {
      throw new LauncherReleaseError(
        "HOST_NOT_ALLOWED",
        "Download URL host is not allowed for this environment",
      );
    }

    const stored = await Q.launcher.release.findAll(
      { platform: input.platform },
      { select: ["version"] },
    );

    if (stored.some((release) => release.version === input.version)) {
      throw new LauncherReleaseError(
        "DUPLICATE_VERSION",
        `Version ${input.version} is already stored for ${input.platform}`,
      );
    }

    const newest = newestVersion(stored);
    if (newest && !isNewerVersion(input.version, newest.version)) {
      throw new LauncherReleaseError(
        "NOT_NEWER",
        `Version ${input.version} is not newer than ${newest.version}`,
      );
    }

    if (!(await this.downloadAnswers(input.url))) {
      throw new LauncherReleaseError(
        "DOWNLOAD_UNREACHABLE",
        "Download URL did not answer",
      );
    }

    const structuredNotes = parseStructuredNotes(input.structuredNotes);
    if (input.structuredNotes != null && !structuredNotes) {
      logger.warn(
        `Launcher release ${input.version} (${input.platform}) came with structured notes that could not be read, storing its text only`,
      );
    }

    try {
      const release = await Q.launcher.release.createAndReturn({
        version: input.version,
        platform: input.platform,
        url: input.url,
        signature: input.signature,
        notes: input.notes,
        structuredNotes,
        pubDate: input.pubDate,
      });
      logger.info(
        `Launcher release ${release.version} (${release.platform}) published as pending`,
      );
      return release;
    } catch (error) {
      if (error instanceof UniqueViolationError) {
        throw new LauncherReleaseError(
          "DUPLICATE_VERSION",
          `Version ${input.version} is already stored for ${input.platform}`,
        );
      }
      throw error;
    }
  }

  /**
   * The newest released version when it is newer than `currentVersion`, else null. An
   * unknown platform or an unreadable version also yields null, never an error. The update
   * is `required` when any released version newer than `currentVersion` is, also when the
   * newest one itself is not.
   */
  async checkForUpdate(
    platform: string,
    currentVersion: string,
  ): Promise<LauncherUpdate | null> {
    if (!(LAUNCHER_PLATFORMS as readonly string[]).includes(platform)) {
      return null;
    }
    if (!isValidVersion(currentVersion)) return null;

    const { newest, minimumVersion } = await this.getReleased(platform);
    if (!newest || !isNewerVersion(newest.version, currentVersion)) {
      return null;
    }

    return {
      version: newest.version,
      notes: newest.notes,
      pub_date: newest.pubDate.toISOString(),
      url: newest.url,
      signature: newest.signature,
      required:
        minimumVersion !== null &&
        isNewerVersion(minimumVersion, currentVersion),
    };
  }

  /**
   * Whether a launcher of this platform and version is older than the newest released
   * version marked as required, so it has to update before it may keep using the app.
   * False for an unknown platform or an unreadable version, never an error for them.
   */
  async isUpdateRequired(platform: string, version: string): Promise<boolean> {
    if (!(LAUNCHER_PLATFORMS as readonly string[]).includes(platform)) {
      return false;
    }
    if (!isValidVersion(version)) return false;

    const { minimumVersion } = await this.getReleased(platform);
    return minimumVersion !== null && isNewerVersion(minimumVersion, version);
  }

  /** Every stored release of this environment, newest publish first. */
  async list(): Promise<LauncherRelease[]> {
    return await Q.launcher.release.findAll(undefined, {
      orderBy: "createdAt",
      orderDirection: "desc",
    });
  }

  /** The released versions of this environment, highest version first. */
  async listReleased(): Promise<LauncherRelease[]> {
    const released = await Q.launcher.release.findAll({ status: "released" });
    return newestFirst(released);
  }

  /**
   * Releases a pending version so the update check offers it. With `required` every older
   * launcher of its platform has to update to keep using the app. Throws
   * `LauncherReleaseError` otherwise.
   */
  async release(
    id: number,
    byDiscordId: string,
    required = false,
  ): Promise<LauncherRelease> {
    const changed = await Q.launcher.release.updateAll(
      {
        status: "released",
        required,
        releasedAt: new Date(),
        releasedByDiscordId: byDiscordId,
      },
      { id, status: "pending" },
    );

    const release = await this.requireChanged(id, changed, "released");
    logger.info(
      `Launcher release ${release.version} (${release.platform}) released${required ? " as required" : ""} by ${byDiscordId}`,
    );
    return release;
  }

  /** Withdraws a pending or released version so it is never offered. Throws `LauncherReleaseError` otherwise. */
  async withdraw(id: number, byDiscordId: string): Promise<LauncherRelease> {
    const changed = await Q.launcher.release.updateAll(
      {
        status: "withdrawn",
        withdrawnAt: new Date(),
        withdrawnByDiscordId: byDiscordId,
      },
      { id, status: { $in: ["pending", "released"] } },
    );

    const release = await this.requireChanged(id, changed, "withdrawn");
    logger.info(
      `Launcher release ${release.version} (${release.platform}) withdrawn by ${byDiscordId}`,
    );
    return release;
  }

  /** Drops the cached released versions; the next update check reads the database. */
  clearCache(): void {
    this.released.clear();
  }

  private async requireChanged(
    id: number,
    changed: number,
    target: string,
  ): Promise<LauncherRelease> {
    const release = await Q.launcher.release.find({ id });
    if (!release) {
      throw new LauncherReleaseError("NOT_FOUND", "Launcher release not found");
    }
    if (changed === 0) {
      throw new LauncherReleaseError(
        "INVALID_STATE",
        `A ${release.status} release cannot be ${target}`,
      );
    }
    this.clearCache();
    return release;
  }

  private async getReleased(platform: string): Promise<ReleasedVersions> {
    const cached = this.released.get(platform);
    if (cached && cached.expiresAt > Date.now()) return cached;

    const released = await Q.launcher.release.findAll({
      platform,
      status: "released",
    });
    const versions: ReleasedVersions = {
      newest: newestVersion(released),
      minimumVersion:
        newestVersion(released.filter((release) => release.required))
          ?.version ?? null,
    };
    this.released.set(platform, {
      ...versions,
      expiresAt: Date.now() + RELEASED_TTL_MS,
    });
    return versions;
  }

  private async downloadAnswers(url: string): Promise<boolean> {
    try {
      const res = await fetch(url, {
        method: "HEAD",
        signal: AbortSignal.timeout(DOWNLOAD_CHECK_TIMEOUT_MS),
      });
      return res.ok;
    } catch (error) {
      logger.warn(`Launcher release download check failed for ${url}:`, error);
      return false;
    }
  }
}

export const launcherReleaseService = LauncherReleaseService.getInstance();
