import type { ComponentNode, EmbedData } from "@createrington/shared/api/embed";
import {
  PLANNING_CATEGORIES,
  PLANNING_ITEM_STATUSES,
  type PlanningCategory,
  type PlanningItemStatus,
} from "@createrington/shared/planning";
import { pluralize } from "@/lib/format";

export interface HighlightAction {
  type: "highlight";
  selector: string;
  ttlMs?: number;
  label?: string;
}

export interface InsertEmbedAction {
  type: "insert_embed";
  embed: Partial<EmbedData>;
  label?: string;
}

export interface InsertComponentsAction {
  type: "insert_components";
  components: ComponentNode[];
  label?: string;
}

export interface NavigateAction {
  type: "navigate";
  path: string;
  label?: string;
}

export interface PlanCreateAction {
  type: "plan_create";
  title: string;
  body?: string;
  categories: PlanningCategory[];
  subcategoryIds?: number[];
  label?: string;
}

export interface PlanUpdateAction {
  type: "plan_update";
  id: number;
  title?: string;
  body?: string;
  categories?: PlanningCategory[];
  subcategoryIds?: number[];
  status?: PlanningItemStatus;
  label?: string;
}

export type AdminChatAction =
  | HighlightAction
  | InsertEmbedAction
  | InsertComponentsAction
  | NavigateAction
  | PlanCreateAction
  | PlanUpdateAction;

export function isPlanAction(
  action: AdminChatAction,
): action is PlanCreateAction | PlanUpdateAction {
  return action.type === "plan_create" || action.type === "plan_update";
}

export const PENDING_EMBED_KEY = "admin-chat:pending-embed";

export const INSERT_EMBED_EVENT = "admin-chat:insert-embed";

export const PENDING_COMPONENTS_KEY = "admin-chat:pending-components";

export const INSERT_COMPONENTS_EVENT = "admin-chat:insert-components";

export function parseActionsFromMessage(raw: string): {
  content: string;
  actions: AdminChatAction[];
} {
  const actions: AdminChatAction[] = [];
  const fenceRe = /```(action|json)?\s*\n([\s\S]*?)```/g;
  const content = raw.replace(
    fenceRe,
    (match, lang: string | undefined, body: string) => {
      const wasActionFence = lang === "action";
      try {
        const action = coerceAction(JSON.parse(body));
        if (action) {
          actions.push(action);
          return "";
        }
      } catch {}
      if (wasActionFence) return "```action\n" + body + "```";
      return match;
    },
  );
  return { content: content.trim(), actions };
}

const EMBED_FIELDS = new Set([
  "content",
  "title",
  "description",
  "color",
  "url",
  "footer",
  "author",
  "authorUrl",
  "authorIconUrl",
  "thumbnailUrl",
  "imageUrl",
  "thumbnail",
  "image",
  "fields",
  "buttons",
  "actionButtons",
  "timestamp",
]);

export function coerceAction(raw: unknown): AdminChatAction | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const label = typeof rec.label === "string" ? { label: rec.label } : {};
  switch (rec.type) {
    case "highlight":
      if (typeof rec.selector !== "string" || rec.selector.length === 0) {
        return null;
      }
      return {
        type: "highlight",
        selector: rec.selector,
        ...(typeof rec.ttlMs === "number" && { ttlMs: rec.ttlMs }),
        ...label,
      };
    case "navigate":
      if (typeof rec.path !== "string" || !rec.path.startsWith("/")) {
        return null;
      }
      return { type: "navigate", path: rec.path, ...label };
    case "insert_components":
      if (!Array.isArray(rec.components) || rec.components.length === 0) {
        return null;
      }
      return {
        type: "insert_components",
        components: rec.components as ComponentNode[],
        ...label,
      };
    case "insert_embed": {
      const embed = coerceEmbed(rec);
      return embed ? { type: "insert_embed", embed, ...label } : null;
    }
    case "plan_create": {
      const fields = coercePlanFields(rec);
      if (!fields?.title || !fields.categories) return null;
      return {
        ...fields,
        type: "plan_create",
        title: fields.title,
        categories: fields.categories,
        ...label,
      };
    }
    case "plan_update": {
      const fields = coercePlanFields(rec);
      if (!fields || !isPositiveInteger(rec.id)) return null;
      if (Object.keys(fields).length === 0) return null;
      return { ...fields, type: "plan_update", id: rec.id, ...label };
    }
    default:
      return null;
  }
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function coercePlanFields(
  rec: Record<string, unknown>,
): Omit<PlanUpdateAction, "type" | "id" | "label"> | null {
  const fields: Omit<PlanUpdateAction, "type" | "id" | "label"> = {};

  if (rec.title !== undefined) {
    if (typeof rec.title !== "string" || !rec.title.trim()) return null;
    fields.title = rec.title;
  }
  if (rec.body !== undefined) {
    if (typeof rec.body !== "string") return null;
    fields.body = rec.body;
  }
  if (rec.categories !== undefined) {
    if (!Array.isArray(rec.categories) || rec.categories.length === 0) {
      return null;
    }
    const categories = rec.categories.map((value: unknown) =>
      PLANNING_CATEGORIES.find((c) => c === value),
    );
    if (categories.some((category) => !category)) return null;
    fields.categories = categories as PlanningCategory[];
  }
  if (rec.subcategoryIds !== undefined) {
    if (
      !Array.isArray(rec.subcategoryIds) ||
      !rec.subcategoryIds.every(isPositiveInteger)
    ) {
      return null;
    }
    fields.subcategoryIds = rec.subcategoryIds;
  }
  if (rec.status !== undefined) {
    const status = PLANNING_ITEM_STATUSES.find((s) => s === rec.status);
    if (!status) return null;
    fields.status = status;
  }
  return fields;
}

function coerceEmbed(rec: Record<string, unknown>): Partial<EmbedData> | null {
  if (rec.embed && typeof rec.embed === "object") {
    return rec.embed;
  }
  const flattened = Object.fromEntries(
    Object.entries(rec).filter(([key]) => EMBED_FIELDS.has(key)),
  );
  return Object.keys(flattened).length > 0 ? flattened : null;
}

export function describeAction(action: AdminChatAction): string {
  if (action.label) return action.label;
  if (action.type === "highlight") {
    return `Highlight ${action.selector}`;
  }
  if (action.type === "navigate") {
    return `Go to ${action.path}`;
  }
  if (action.type === "insert_components") {
    const count = action.components.length;
    return `Insert components message (${pluralize(count, "component")})`;
  }
  if (action.type === "plan_create") {
    return `New plan: ${action.title}`;
  }
  if (action.type === "plan_update") {
    return `Edit plan #${action.id}`;
  }
  const title = action.embed.title ?? "untitled";
  return `Insert embed: ${title}`;
}
