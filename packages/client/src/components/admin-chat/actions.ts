/**
 * Admin-chat action envelopes — a narrow, pre-approved set of things Claude
 * can ask the admin to do from inside a chat reply. Every action renders as
 * a preview card with an explicit Apply button, so Claude never takes an
 * action unilaterally; the admin confirms.
 *
 * Shape on the wire: Claude emits a fenced code block with language `action`
 * containing a JSON object matching one of the variants below.
 *
 *     ```action
 *     { "type": "highlight", "selector": "[data-testid='ban-button']" }
 *     ```
 */

import type { EmbedData } from "@createrington/shared/api/embed";

export interface HighlightAction {
  type: "highlight";
  /** CSS selector resolved against the current document. */
  selector: string;
  /** How long to keep the highlight visible. Defaults to 3000ms. */
  ttlMs?: number;
  /** Optional label shown on the preview card. */
  label?: string;
}

export interface InsertEmbedAction {
  type: "insert_embed";
  embed: Partial<EmbedData>;
  /** Optional label shown on the preview card. */
  label?: string;
}

export interface NavigateAction {
  type: "navigate";
  /** Same-origin path to push into the router (e.g. "/admin/tools/embed-builder"). */
  path: string;
  /** Optional label shown on the preview card. */
  label?: string;
}

export type AdminChatAction =
  | HighlightAction
  | InsertEmbedAction
  | NavigateAction;

/**
 * Server-persisted action record — matches the ChatAction Prisma row shape
 * that arrives over SSE (`action` events) and on history load (nested under
 * each `ChatMessage`). The `payload` carries the envelope that the widget
 * would previously have parsed out of a fenced code block.
 */
export interface ChatActionRecord {
  id: number;
  sessionId: number;
  chatMessageId: number;
  type: string;
  payload: unknown;
  createdAt: string | Date;
}

/** sessionStorage key the EmbedBuilder picks up on mount if set. */
export const PENDING_EMBED_KEY = "admin-chat:pending-embed";

/** Event the EmbedBuilder listens to when already mounted. */
export const INSERT_EMBED_EVENT = "admin-chat:insert-embed";

/**
 * Pull action envelopes out of an assistant message. Envelopes that parse
 * successfully are stripped from the rendered text so the admin sees the
 * preview card instead of raw JSON; malformed envelopes are left as a code
 * block so the bug is visible rather than silently swallowed.
 */
export function parseActionsFromMessage(raw: string): {
  content: string;
  actions: AdminChatAction[];
} {
  const actions: AdminChatAction[] = [];
  // Accept the documented ```action fence AND common fallbacks Claude
  // reaches for when drafting JSON (```json, bare ```). Only promote to
  // an action if the JSON body actually matches our action shape — other
  // JSON blocks render as-is so Claude can still illustrate, say, a DB
  // query payload without it getting swallowed.
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
      } catch {
        // fall through — render the original fence so the admin can see it
      }
      // Not an action — leave the original code block untouched.
      if (wasActionFence) return "```action\n" + body + "```";
      return match;
    },
  );
  return { content: content.trim(), actions };
}

/**
 * Fields that belong inside the `embed` sub-object. When Claude flattens
 * these to the top level of an insert_embed envelope (a common mistake),
 * we auto-wrap them so the action is still usable.
 */
const EMBED_FIELDS = new Set([
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

/**
 * Validate and normalize an action envelope. Exported so SSE `action` events
 * (MCP tool calls on the backend) can reuse the same flat-field forgiveness
 * that the fence parser applies. Returns the narrowed envelope or null.
 */
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
  if (rec.type === "insert_embed") {
    if (rec.embed && typeof rec.embed === "object") return true;
    // Forgiveness: Claude sometimes flattens the embed fields to the top
    // level of the envelope. If we see any known embed field as a sibling
    // of `type`, pull them into an `embed` object in place so the action
    // handler still works.
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

/**
 * Short human label for the preview card. Falls back to a derived summary
 * when the action doesn't carry a label.
 */
export function describeAction(action: AdminChatAction): string {
  if (action.label) return action.label;
  if (action.type === "highlight") {
    return `Highlight ${action.selector}`;
  }
  if (action.type === "navigate") {
    return `Go to ${action.path}`;
  }
  const title = (action.embed.title as string | undefined) ?? "untitled";
  return `Insert embed: ${title}`;
}
