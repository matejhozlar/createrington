import { useCallback, useState } from "react";
import { Check, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToastActions } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  PENDING_EMBED_KEY,
  INSERT_EMBED_EVENT,
  PENDING_COMPONENTS_KEY,
  INSERT_COMPONENTS_EVENT,
  describeAction,
  type AdminChatAction,
  type HighlightAction,
  type InsertEmbedAction,
  type InsertComponentsAction,
} from "../actions";
import { EmbedActionPreview } from "./EmbedActionPreview";
import { ComponentsActionPreview } from "./ComponentsActionPreview";

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
  } catch {}
  navigate("/admin/tools/embed-builder");
}

function applyInsertComponents(
  action: InsertComponentsAction,
  navigate: (to: string) => void,
): void {
  const serialized = JSON.stringify(action.components);
  const onBuilderPage = window.location.pathname.startsWith(
    "/admin/tools/embed-builder",
  );
  if (onBuilderPage) {
    window.dispatchEvent(
      new CustomEvent(INSERT_COMPONENTS_EVENT, { detail: action.components }),
    );
    return;
  }
  try {
    sessionStorage.setItem(PENDING_COMPONENTS_KEY, serialized);
  } catch {}
  navigate("/admin/tools/embed-builder");
}

interface ActionCardProps {
  action: AdminChatAction;
  storageKey: string;
  navigate: (to: string) => void;
}

export function ActionCard({
  action,
  storageKey,
  navigate,
}: ActionCardProps): React.JSX.Element {
  const toast = useToastActions();
  const persistKey = `admin-chat-action:${storageKey}`;
  const [state, setState] = useState<"pending" | "applied" | "dismissed">(
    () => {
      try {
        const v = sessionStorage.getItem(persistKey);
        if (v === "applied" || v === "dismissed") return v;
      } catch {}
      return "pending";
    },
  );

  const setPersistent = useCallback(
    (next: "applied" | "dismissed") => {
      setState(next);
      try {
        sessionStorage.setItem(persistKey, next);
      } catch {}
    },
    [persistKey],
  );

  const onApply = (): void => {
    if (action.type === "highlight") {
      if (applyHighlight(action)) {
        setPersistent("applied");
      } else {
        toast.error("Couldn't find that element on this page");
      }
      return;
    }
    if (action.type === "navigate") {
      navigate(action.path);
      setPersistent("applied");
      return;
    }
    if (action.type === "insert_components") {
      applyInsertComponents(action, navigate);
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
        : action.type === "insert_components"
          ? "Insert components"
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
      {action.type === "insert_components" && (
        <ComponentsActionPreview components={action.components} />
      )}
      <div className="flex items-center gap-1.5">
        {state === "pending" && (
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
        )}
        {state === "applied" && (
          <>
            <span className="text-[0.6875rem] italic text-muted-foreground">
              Applied
            </span>
            <Button size="xs" variant="ghost" onClick={onApply} type="button">
              <RotateCcw size={12} />
              Re-apply
            </Button>
          </>
        )}
        {state === "dismissed" && (
          <span className="text-[0.6875rem] italic text-muted-foreground">
            Dismissed
          </span>
        )}
      </div>
    </div>
  );
}
