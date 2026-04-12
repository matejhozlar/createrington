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

export type AdminChatAction = HighlightAction | InsertEmbedAction;

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
  const content = raw.replace(/```action\s*\n([\s\S]*?)```/g, (_m, body) => {
    try {
      const parsed: unknown = JSON.parse(body);
      if (isValidAction(parsed)) {
        actions.push(parsed);
        return "";
      }
    } catch {
      // fall through — render as raw so the admin can see the bad JSON
    }
    return "```action\n" + body + "```";
  });
  return { content: content.trim(), actions };
}

function isValidAction(a: unknown): a is AdminChatAction {
  if (!a || typeof a !== "object") return false;
  const rec = a as Record<string, unknown>;
  if (rec.type === "highlight") {
    return typeof rec.selector === "string" && rec.selector.length > 0;
  }
  if (rec.type === "insert_embed") {
    return rec.embed !== null && typeof rec.embed === "object";
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
  const title = (action.embed.title as string | undefined) ?? "untitled";
  return `Insert embed: ${title}`;
}
