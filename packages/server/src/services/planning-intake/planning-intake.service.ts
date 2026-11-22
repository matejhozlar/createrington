import type { z } from "zod";
import { Q, planningRepo } from "@/db";
import { siteUrl } from "@/config/site-url";
import { BadRequestError } from "@/errors";
import {
  AutomationSessionClient,
  type AutomationSessionStatus,
} from "@/services/claude-automation/session-client";
import {
  PLANNING_CATEGORIES,
  PLANNING_COMMENT_MAX_LENGTH,
  PLANNING_TEXT_MAX_LENGTH,
  PLANNING_TITLE_MAX_LENGTH,
  planningCommentSchema,
  planningTextSchema,
  planningTitleSchema,
  type PlanningCategory,
} from "@createrington/shared/planning";

const MAX_CARDS = 300;
const CARD_DETAILS_LENGTH = 300;

const CATEGORY_SCOPE: Record<PlanningCategory, string> = {
  modpack:
    "The modpack and the game itself: mods, recipes, the economy, quests, performance",
  website: "The website and the launcher: player pages and admin pages",
  discord:
    "The Discord server and its bots: commands, roles, channels, tickets",
  server:
    "Running the server and its community: the world, rules, events, schedule",
};

export interface PlanningDiscussion {
  transcript: string;
  messageCount: number;
  requestedBy: string;
  sourceLabel: string;
  sourceUrl?: string;
  note?: string;
}

interface PlanningBoard {
  categories: {
    key: PlanningCategory;
    label: string;
    subcategories: { id: number; name: string }[];
  }[];
  cards: {
    id: number;
    title: string;
    category: PlanningCategory;
    subcategory: string | null;
    status: string;
    details: string;
  }[];
}

export type PlanningProposal =
  | {
      action: "create";
      title: string;
      body: string;
      category: string;
      subcategoryId: number | null;
    }
  | { action: "comment"; cardId: number; cardTitle: string; body: string };

export interface PlanningIntakeStatus extends AutomationSessionStatus {
  proposal: PlanningProposal | null;
  reason: string | null;
}

export interface PlanningIntakeResult {
  kind: "created" | "commented";
  itemId: number;
  title: string;
  url: string;
}

function accepted<T>(
  schema: z.ZodType<T>,
  text: string,
  maxLength: number,
  what: string,
): T {
  const parsed = schema.safeParse(text.trim().slice(0, maxLength));
  if (!parsed.success) {
    throw new BadRequestError(`The proposed ${what} is empty`);
  }
  return parsed.data;
}

function isCategory(value: string): value is PlanningCategory {
  return (PLANNING_CATEGORIES as readonly string[]).includes(value);
}

/**
 * Turns a Discord discussion into a plan through a claude-automation planning
 * session. The session is sent the discussion and the existing plans and only
 * proposes: a new plan, a comment for an existing plan, or nothing. Writing
 * to planning happens here, in `apply`, as the admin who asked.
 */
export class PlanningIntakeService {
  private readonly sessions = new AutomationSessionClient<
    PlanningDiscussion & PlanningBoard,
    PlanningIntakeStatus
  >("planning", "Planning intake", {
    status: "failed",
    result: "orphaned",
    proposal: null,
    reason: null,
  });

  /** Starts a session for a discussion; throws AutomationStartError on refusal or failure. */
  async start(discussion: PlanningDiscussion): Promise<{ sessionId: number }> {
    return this.sessions.start({ ...discussion, ...(await this.readBoard()) });
  }

  /** Polls until the session settles; null when it is still running after the wait. */
  waitForOutcome(sessionId: number): Promise<PlanningIntakeStatus | null> {
    return this.sessions.waitForOutcome(sessionId);
  }

  /**
   * Writes a proposal to planning: a new draft, or a comment on the plan it
   * names. Throws when the category is unknown or the plan is gone.
   */
  async apply(
    proposal: PlanningProposal,
    by: { discordId: string; sourceUrl: string | null },
  ): Promise<PlanningIntakeResult> {
    if (proposal.action === "comment") {
      const body = accepted(
        planningCommentSchema,
        proposal.body,
        PLANNING_COMMENT_MAX_LENGTH,
        "comment",
      );
      const item = await Q.planning.item.get({ id: proposal.cardId });
      await Q.planning.item.comment.create({
        itemId: item.id,
        authorDiscordId: by.discordId,
        body,
        sourceUrl: by.sourceUrl,
      });
      return this.result("commented", item.id, item.title);
    }

    const title = accepted(
      planningTitleSchema,
      proposal.title,
      PLANNING_TITLE_MAX_LENGTH,
      "title",
    );
    const body = accepted(
      planningTextSchema,
      proposal.body,
      PLANNING_TEXT_MAX_LENGTH,
      "details",
    );
    if (!isCategory(proposal.category)) {
      throw new BadRequestError(
        `Unknown planning category "${proposal.category}"`,
      );
    }
    const subcategory =
      proposal.subcategoryId === null
        ? null
        : await Q.planning.subcategory.find({ id: proposal.subcategoryId });
    const item = await planningRepo.createItem(
      {
        title,
        body,
        category: proposal.category,
        subcategoryId:
          subcategory?.category === proposal.category ? subcategory.id : null,
        status: "draft",
      },
      by.discordId,
      { sourceUrl: by.sourceUrl },
    );
    return this.result("created", item.id, item.title);
  }

  private result(
    kind: PlanningIntakeResult["kind"],
    itemId: number,
    title: string,
  ): PlanningIntakeResult {
    return {
      kind,
      itemId,
      title,
      url: siteUrl(`/admin/planning/${itemId}`),
    };
  }

  private async readBoard(): Promise<PlanningBoard> {
    const [subcategories, items] = await Promise.all([
      Q.planning.subcategory.findAll(
        {},
        {
          orderBy: [
            { field: "position", direction: "asc" },
            { field: "name", direction: "asc" },
          ],
        },
      ),
      Q.planning.item.findAll(
        {},
        { orderBy: "updatedAt", orderDirection: "desc", limit: MAX_CARDS },
      ),
    ]);
    const subcategoryName = new Map(subcategories.map((s) => [s.id, s.name]));

    return {
      categories: PLANNING_CATEGORIES.map((key) => ({
        key,
        label: CATEGORY_SCOPE[key],
        subcategories: subcategories
          .filter((s) => s.category === key)
          .map((s) => ({ id: s.id, name: s.name })),
      })),
      cards: items.map((item) => ({
        id: item.id,
        title: item.title,
        category: item.category,
        subcategory:
          item.subcategoryId === null
            ? null
            : (subcategoryName.get(item.subcategoryId) ?? null),
        status: item.status,
        details: (item.body ?? "").slice(0, CARD_DETAILS_LENGTH),
      })),
    };
  }
}

export const planningIntakeService = new PlanningIntakeService();
