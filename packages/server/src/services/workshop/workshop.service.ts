import { Q } from "@/db";
import { BadRequestError, NotFoundError } from "@/app/middleware/error-handler";
import type { WorkshopModEventListItem } from "@/db/queries/workshop/mod/event";
import type {
  Workshop,
  WorkshopModEventType,
  WorkshopModStatus,
} from "@createrington/shared/db";
import { modpackService } from "@/services/modpack/modpack.service";
import type { ModpackModListItem } from "@/services/modpack/modpack.service";

export interface WorkshopPackView {
  modpack: {
    name: string;
    description: string | null;
    curseforgeUrl: string | null;
  };
  mods: ModpackModListItem[];
}

export interface WorkshopParticipantSample {
  minecraftUuid: string;
  minecraftUsername: string;
}

export interface WorkshopTopMod {
  workshopModId: number;
  name: string;
  primaryAuthor: string | null;
  upvoteCount: number;
  thumbnailUrl: string | null;
}

const PACK_SAMPLE_SIZE = 4;
const TOP_MOD_SAMPLE_SIZE = 3;
const PARTICIPANT_SAMPLE_SIZE = 5;

export interface WorkshopPackSampleMod {
  id: number;
  name: string;
  thumbnailUrl: string | null;
}

export interface WorkshopSummary {
  packModCount: number;
  pendingModCount: number;
  suggestionCount: number;
  participantCount: number;
  participantSample: WorkshopParticipantSample[];
  topMods: WorkshopTopMod[];
  packModSample: WorkshopPackSampleMod[];
}

export type WorkshopListItem = Workshop & { summary: WorkshopSummary | null };

export const USER_VISIBLE_MOD_STATUSES: WorkshopModStatus[] = [
  "pending",
  "approved",
  "testing",
  "next_update",
  "in_pack",
];

/**
 * Community modpack workshops, read side: listing and lookup with the
 * visibility rules users are held to (drafts and archived workshops read as
 * missing), the pack page, and the event timeline.
 */
export class WorkshopService {
  /** Workshops users may see (open and closed), with stats for open ones. */
  async listVisibleWorkshops(): Promise<WorkshopListItem[]> {
    const workshops = await Q.workshop.findAll(
      { status: { $in: ["open", "closed"] } },
      { orderBy: "createdAt", orderDirection: "desc" },
    );
    return Promise.all(
      workshops.map(async (workshop) => ({
        ...workshop,
        summary:
          workshop.status === "open"
            ? await this.getWorkshopSummary(workshop)
            : null,
      })),
    );
  }

  /** All workshops regardless of status, for the admin panel. */
  async listAllWorkshops(): Promise<(Workshop & { modCount: number })[]> {
    return Q.workshop.listAllWithModCount();
  }

  /** A user-visible workshop by slug; drafts and archived workshops read as missing. */
  async getVisibleWorkshopBySlug(slug: string): Promise<Workshop> {
    const workshop = await Q.workshop.find({ slug });
    if (
      !workshop ||
      workshop.status === "draft" ||
      workshop.status === "archived"
    ) {
      throw new NotFoundError(`Workshop "${slug}" not found`);
    }
    return workshop;
  }

  /** A workshop by id regardless of status; throws when missing. */
  async getWorkshop(workshopId: number): Promise<Workshop> {
    const workshop = await Q.workshop.find({ id: workshopId });
    if (!workshop) throw new NotFoundError(`Workshop #${workshopId} not found`);
    return workshop;
  }

  /** Members of the workshop's modpack, for the admin members card. */
  async getPackMods(workshopId: number): Promise<ModpackModListItem[]> {
    const workshop = await this.getWorkshop(workshopId);
    return modpackService.getPackMods(workshop.modpackId);
  }

  /** The workshop's modpack with its members, for the pack page. */
  async getPack(
    workshopId: number,
    options: { userVisible?: boolean } = {},
  ): Promise<WorkshopPackView> {
    const workshop = await this.getWorkshop(workshopId);
    if (options.userVisible) this.assertUserVisible(workshop);
    const modpack = await modpackService.getModpack(workshop.modpackId);
    const [mods, curseforgeUrl] = await Promise.all([
      modpackService.getPackMods(modpack.id, { liveOnly: true }),
      modpackService.getPackCurseforgeUrl(modpack),
    ]);
    return {
      modpack: {
        name: modpack.name,
        description: modpack.description,
        curseforgeUrl,
      },
      mods,
    };
  }

  private async getWorkshopSummary(
    workshop: Workshop,
  ): Promise<WorkshopSummary> {
    const workshopId = workshop.id;
    const [packModCount, participants, countsByStatus, topMods, packModSample] =
      await Promise.all([
        Q.modpack.mod.count({
          modpackId: workshop.modpackId,
          droppedFromManifestAt: null,
        }),
        Q.workshop.getParticipantSummary(workshopId, PARTICIPANT_SAMPLE_SIZE),
        Q.workshop.mod.countBy("status", {
          workshopId,
          status: { $in: USER_VISIBLE_MOD_STATUSES },
        }),
        Q.workshop.mod.getTopPendingByUpvotes(workshopId, TOP_MOD_SAMPLE_SIZE),
        Q.modpack.mod.getSampleWithProjects(
          workshop.modpackId,
          PACK_SAMPLE_SIZE,
        ),
      ]);

    let suggestionCount = 0;
    for (const count of countsByStatus.values()) suggestionCount += count;

    return {
      packModCount,
      pendingModCount: countsByStatus.get("pending") ?? 0,
      suggestionCount,
      participantCount: participants.count,
      participantSample: participants.sample,
      topMods,
      packModSample,
    };
  }

  /** Throws NotFoundError for a draft or archived workshop, which users must not see. */
  assertUserVisible(workshop: Workshop): void {
    if (workshop.status === "draft" || workshop.status === "archived") {
      throw new NotFoundError(`Workshop #${workshop.id} not found`);
    }
  }

  /** A user-visible workshop that is open for suggestions; throws otherwise. */
  async getOpenWorkshop(workshopId: number): Promise<Workshop> {
    const workshop = await this.getWorkshop(workshopId);
    this.assertUserVisible(workshop);
    if (workshop.status !== "open") {
      throw new BadRequestError("This workshop is not open for suggestions");
    }
    return workshop;
  }

  /** Newest-first page of everything that happened to this workshop's mods. */
  async getWorkshopEvents(
    workshopId: number,
    options: {
      eventType?: WorkshopModEventType;
      search?: string;
      limit: number;
      offset: number;
    },
  ): Promise<{ events: WorkshopModEventListItem[]; total: number }> {
    await this.getWorkshop(workshopId);
    return Q.workshop.mod.event.search({ workshopId, ...options });
  }
}

export const workshopService = new WorkshopService();
