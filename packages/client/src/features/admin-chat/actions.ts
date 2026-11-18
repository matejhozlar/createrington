import type { ComponentNode, EmbedData } from "@createrington/shared/api/embed";

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

export type AdminChatAction =
  HighlightAction | InsertEmbedAction | InsertComponentsAction | NavigateAction;

export interface ChatActionRecord {
  id: number;
  sessionId: number;
  chatMessageId: number;
  type: string;
  payload: unknown;
  createdAt: string | Date;
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
        const parsed: unknown = JSON.parse(body);
        if (isValidAction(parsed)) {
          actions.push(parsed);
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
  if (isValidAction(raw)) return raw;
  return null;
}

function isValidAction(a: unknown): a is AdminChatAction {
  if (!a || typeof a !== "object") return false;
  const rec = a as Record<string, unknown>;
  if (rec.type === "highlight") {
    return typeof rec.selector === "string" && rec.selector.length > 0;
  }
  if (rec.type === "navigate") {
    return (
      typeof rec.path === "string" &&
      rec.path.length > 0 &&
      rec.path.startsWith("/")
    );
  }
  if (rec.type === "insert_components") {
    return Array.isArray(rec.components) && rec.components.length > 0;
  }
  if (rec.type === "insert_embed") {
    if (rec.embed && typeof rec.embed === "object") return true;
    const flattened: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rec)) {
      if (EMBED_FIELDS.has(k)) flattened[k] = v;
    }
    if (Object.keys(flattened).length > 0) {
      rec.embed = flattened;
      for (const k of Object.keys(flattened)) delete rec[k];
      return true;
    }
    return false;
  }
  return false;
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
    return `Insert components message (${count} component${count === 1 ? "" : "s"})`;
  }
  const title = action.embed.title ?? "untitled";
  return `Insert embed: ${title}`;
}
