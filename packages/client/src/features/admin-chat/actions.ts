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
    default:
      return null;
  }
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
    return `Insert components message (${count} component${count === 1 ? "" : "s"})`;
  }
  const title = action.embed.title ?? "untitled";
  return `Insert embed: ${title}`;
}
