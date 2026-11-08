import { BadRequestError, ConflictError } from "@/app/middleware/error-handler";
import config from "@/config";
import { db, Q } from "@/db";
import { UniqueViolationError } from "@/db/utils";
import { settings } from "@/services/settings";
import type {
  LauncherPack,
  LauncherPackSource,
  Modpack,
} from "@createrington/shared/db";
import { launcherPackService, PACK_ORDER } from "./launcher-pack.service";

const DEFAULT_PACK_SLUG = "createrington";

const SLUG_CONSTRAINT = "uq_launcher_pack_slug";
const MODPACK_CONSTRAINT = "uq_launcher_pack_modpack";

export interface OwnedLauncherPack extends LauncherPack {
  modpack: Pick<Modpack, "id" | "name" | "curseforgeProjectId" | "serverId">;
  latestVersion: string | null;
}

export type LauncherPackCandidate = Pick<
  Modpack,
  "id" | "name" | "curseforgeProjectId" | "serverId"
>;

/**
 * The owner's list of packs offered to the launcher: `launcher_pack` rows
 * keyed by the slug the launcher stores, in the owner's order. The first row
 * is seeded once at startup for the modpack linked to
 * `CURSEFORGE_MODPACK_PROJECT_ID`, so a deploy needs no setup step, and a
 * table the owner emptied afterwards stays empty.
 */
export class LauncherPackAdminService {
  /**
   * Offers the modpack linked to `CURSEFORGE_MODPACK_PROJECT_ID` to the
   * launcher as the `createrington` pack, once: the first time a pack is
   * stored, by this seed or by the owner, that is recorded, and from then on
   * the table is the owner's, empty or not. No-op while no modpack carries
   * that project, so the seed happens on a later start once one does.
   */
  async seedDefaultPack(): Promise<void> {
    if (await settings.getLauncherPacksSeeded()) return;
    if ((await Q.launcher.pack.count()) > 0) {
      await settings.markLauncherPacksSeeded();
      return;
    }
    const modpack = await Q.modpack.find({
      curseforgeProjectId: config.curseforge.modpackProjectId,
    });
    if (!modpack) return;

    await Q.launcher.pack.create({
      slug: DEFAULT_PACK_SLUG,
      modpackId: modpack.id,
      source: "curseforge",
    });
    await settings.markLauncherPacksSeeded();
    logger.info(
      `Offering ${modpack.name} to the launcher as the "${DEFAULT_PACK_SLUG}" pack`,
    );
  }

  /** Every pack row in the owner's order, enabled or not, with the modpack it points at and the version of its newest ready release. */
  async listOwned(): Promise<OwnedLauncherPack[]> {
    const packs = await Q.launcher.pack.findAll({}, PACK_ORDER);
    if (packs.length === 0) return [];
    const modpacks = await Q.modpack.findAll(
      { id: { $in: packs.map((pack) => pack.modpackId) } },
      { select: ["id", "name", "curseforgeProjectId", "serverId"] },
    );
    const modpackById = new Map(modpacks.map((row) => [row.id, row]));
    return Promise.all(
      packs.map(async (pack) => {
        const modpack = modpackById.get(pack.modpackId);
        if (!modpack) {
          throw new Error(
            `Launcher pack "${pack.slug}" points at modpack #${pack.modpackId}, which does not exist`,
          );
        }
        const release = await launcherPackService.findLatestRelease(
          pack.modpackId,
        );
        return { ...pack, modpack, latestVersion: release?.version ?? null };
      }),
    );
  }

  /** The modpacks no pack row points at yet, by name, for the owner to pick from. */
  async listCandidates(): Promise<LauncherPackCandidate[]> {
    const [modpacks, packs] = await Promise.all([
      Q.modpack.findAll(
        {},
        {
          select: ["id", "name", "curseforgeProjectId", "serverId"],
          orderBy: "name",
          orderDirection: "asc",
        },
      ),
      Q.launcher.pack.findAll({}, { select: ["modpackId"] }),
    ]);
    const offered = new Set(packs.map((pack) => pack.modpackId));
    return modpacks.filter((modpack) => !offered.has(modpack.id));
  }

  /**
   * Offers a modpack to the launcher under a new slug, last in the list.
   * Throws `NotFoundError` for an unknown modpack, `BadRequestError` when a
   * pack served from CurseForge has no CurseForge project linked, and
   * `ConflictError` when the slug is taken or the modpack is already offered.
   * Records that a pack was stored, so the startup seed stays quiet from now
   * on.
   */
  async addPack(input: {
    slug: string;
    modpackId: number;
    source: LauncherPackSource;
  }): Promise<LauncherPack> {
    const modpack = await Q.modpack.get({ id: input.modpackId });
    if (input.source === "curseforge" && modpack.curseforgeProjectId === null) {
      throw new BadRequestError(
        `"${modpack.name}" has no CurseForge project linked, so its releases cannot come from CurseForge`,
      );
    }

    const [last] = await Q.launcher.pack.findAll(
      {},
      { orderBy: "position", orderDirection: "desc", limit: 1 },
    );
    let pack: LauncherPack;
    try {
      pack = await Q.launcher.pack.createAndReturn({
        slug: input.slug,
        modpackId: modpack.id,
        source: input.source,
        position: last ? last.position + 1 : 0,
      });
    } catch (error) {
      if (error instanceof UniqueViolationError) {
        if (error.constraint === SLUG_CONSTRAINT) {
          throw new ConflictError(
            `The launcher already offers a pack as "${input.slug}"`,
          );
        }
        if (error.constraint === MODPACK_CONSTRAINT) {
          throw new ConflictError(
            `The launcher already offers "${modpack.name}"`,
          );
        }
      }
      throw error;
    }
    await settings.markLauncherPacksSeeded();
    logger.info(
      `Offering ${modpack.name} to the launcher as the "${pack.slug}" pack (${pack.source})`,
    );
    return pack;
  }

  /** Shows or hides a pack in the launcher's list. Its releases keep being prepared either way. Throws `NotFoundError` for an unknown pack. */
  async setPackEnabled(id: number, enabled: boolean): Promise<LauncherPack> {
    return Q.launcher.pack.updateAndReturn(
      { id },
      { enabled, updatedAt: new Date() },
    );
  }

  /**
   * Puts the packs in the given order, first id first. Throws
   * `BadRequestError` unless the ids are exactly the stored packs, each once.
   */
  async reorderPacks(ids: number[]): Promise<LauncherPack[]> {
    const packs = await Q.launcher.pack.findAll({}, PACK_ORDER);
    const stored = new Set(packs.map((pack) => pack.id));
    const wanted = new Set(ids);
    if (
      ids.length !== packs.length ||
      wanted.size !== ids.length ||
      ids.some((id) => !stored.has(id))
    ) {
      throw new BadRequestError(
        "The new order has to name every launcher pack exactly once",
      );
    }

    const now = new Date();
    await db.inTransaction(async (tx) => {
      for (const [position, id] of ids.entries()) {
        await tx.launcher.pack.updateAll({ position, updatedAt: now }, { id });
      }
    });
    return Q.launcher.pack.findAll({}, PACK_ORDER);
  }

  /** Stops offering a pack; a launcher that stored its slug gets `PACK_NOT_FOUND` from then on. Throws `NotFoundError` for an unknown pack. */
  async removePack(id: number): Promise<LauncherPack> {
    const pack = await Q.launcher.pack.get({ id });
    await Q.launcher.pack.delete({ id });
    logger.info(`No longer offering the "${pack.slug}" pack to the launcher`);
    return pack;
  }
}

export const launcherPackAdminService = new LauncherPackAdminService();
