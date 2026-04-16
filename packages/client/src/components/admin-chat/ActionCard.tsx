import { useCallback, useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  PENDING_EMBED_KEY,
  INSERT_EMBED_EVENT,
  describeAction,
  type AdminChatAction,
  type HighlightAction,
  type InsertEmbedAction,
} from "./actions";
import { EmbedActionPreview } from "./EmbedActionPreview";

/**
 * Apply a highlight action to the current document. Scrolls the element
 * into view and flashes an outline via .ac-highlighted for ttlMs (default
 * 3s). Returns true if the selector matched an element.
 */
function applyHighlight(action: HighlightAction): boolean {
  try {
    const el = document.querySelector(action.selector);
    if (!(el instanceof HTMLElement)) return false;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ac-highlighted");
    const ttl = action.ttlMs ?? 3000;
    window.setTimeout(() => el.classList.remove("ac-highlighted"), ttl);
    return true;
  } catch {
    return false;
  }
}

/**
 * Apply an insert_embed action. If the user is already on the embed
 * builder, dispatches INSERT_EMBED_EVENT so it can apply immediately.
 * Otherwise stashes the embed in sessionStorage under PENDING_EMBED_KEY
 * and navigates there — the builder picks it up on mount.
 */
function applyInsertEmbed(
  action: InsertEmbedAction,
  navigate: (to: string) => void,
): void {
  const serialized = JSON.stringify(action.embed);
  const onBuilderPage = window.location.pathname.startsWith(
    "/admin/tools/embed-builder",
  );
  if (onBuilderPage) {
    window.dispatchEvent(
      new CustomEvent(INSERT_EMBED_EVENT, { detail: action.embed }),
    );
    return;
  }
  try {
    sessionStorage.setItem(PENDING_EMBED_KEY, serialized);
  } catch {
    // Best-effort — if storage is unavailable, navigation alone still lets
    // the admin reapply from chat history.
  }
  navigate("/admin/tools/embed-builder");
}

interface ActionCardProps {
  action: AdminChatAction;
  /** Unique-per-session key for persisting applied state across polls. */
  storageKey: string;
  navigate: (to: string) => void;
}

export function ActionCard({
  action,
  storageKey,
  navigate,
}: ActionCardProps): React.JSX.Element {
  const persistKey = `admin-chat-action:${storageKey}`;
  const [state, setState] = useState<"pending" | "applied" | "dismissed">(
    () => {
      try {
        const v = sessionStorage.getItem(persistKey);
        if (v === "applied" || v === "dismissed") return v;
      } catch {
        // ignore
      }
      return "pending";
    },
  );

  const setPersistent = useCallback(
    (next: "applied" | "dismissed") => {
      setState(next);
      try {
        sessionStorage.setItem(persistKey, next);
      } catch {
        // ignore
      }
    },
    [persistKey],
  );

  const onApply = (): void => {
    if (action.type === "highlight") {
      const ok = applyHighlight(action);
      setPersistent(ok ? "applied" : "dismissed");
      return;
    }
    if (action.type === "navigate") {
      navigate(action.path);
      setPersistent("applied");
      return;
    }
    applyInsertEmbed(action, navigate);
    setPersistent("applied");
  };

  const typeLabel =
    action.type === "highlight"
      ? "Highlight"
      : action.type === "navigate"
        ? "Navigate"
        : "Insert embed";

  return (
    <div
      className={cn(
        "flex max-w-[90%] flex-col gap-1.5 self-stretch rounded-lg border border-border bg-muted/60 px-2.5 py-2 text-xs transition-opacity",
        state === "applied" && "opacity-70",
        state === "dismissed" && "opacity-50",
      )}
    >
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Sparkles size={12} className="shrink-0 text-primary" />
        <span className="text-[0.625rem] font-semibold tracking-wider text-foreground uppercase">
          {typeLabel}
        </span>
        <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
          {describeAction(action)}
        </span>
      </div>
      {action.type === "insert_embed" && (
        <EmbedActionPreview embed={action.embed} />
      )}
      <div className="flex items-center gap-1.5">
        {state === "pending" ? (
          <>
            <Button size="xs" onClick={onApply} type="button">
              <Check size={12} />
              Apply
            </Button>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => setPersistent("dismissed")}
              type="button"
            >
              Dismiss
            </Button>
          </>
        ) : (
          <span className="text-[0.6875rem] italic text-muted-foreground">
            {state === "applied" ? "Applied" : "Dismissed"}
          </span>
        )}
      </div>
    </div>
  );
}
