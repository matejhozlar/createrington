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
} from "../actions";
import { usePlanAction } from "../hooks/use-plan-action";
import { EmbedActionPreview } from "./EmbedActionPreview";
import { PlanActionPreview } from "./PlanActionPreview";
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

const EMBED_BUILDER_PATH = "/admin/tools/embed-builder";

const BUILDER_TARGETS = {
  insert_embed: { event: INSERT_EMBED_EVENT, storageKey: PENDING_EMBED_KEY },
  insert_components: {
    event: INSERT_COMPONENTS_EVENT,
    storageKey: PENDING_COMPONENTS_KEY,
  },
} as const;

const TYPE_LABELS: Record<AdminChatAction["type"], string> = {
  highlight: "Highlight",
  navigate: "Navigate",
  insert_embed: "Insert embed",
  insert_components: "Insert components",
  plan_create: "New plan",
  plan_update: "Edit plan",
};

function sendToEmbedBuilder(
  target: keyof typeof BUILDER_TARGETS,
  payload: unknown,
  navigate: (to: string) => void,
): void {
  const { event, storageKey } = BUILDER_TARGETS[target];
  if (window.location.pathname.startsWith(EMBED_BUILDER_PATH)) {
    window.dispatchEvent(new CustomEvent(event, { detail: payload }));
    return;
  }
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(payload));
  } catch {}
  navigate(EMBED_BUILDER_PATH);
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

  const plan = usePlanAction();
  const isPlanAction =
    action.type === "plan_create" || action.type === "plan_update";

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
    if (isPlanAction) {
      void plan.apply(action).then(
        (id) => {
          setPersistent("applied");
          navigate(`/admin/planning/${id}`);
        },
        (error: unknown) =>
          toast.error(
            error instanceof Error ? error.message : "Could not save the plan",
          ),
      );
      return;
    }
    sendToEmbedBuilder(
      action.type,
      action.type === "insert_embed" ? action.embed : action.components,
      navigate,
    );
    setPersistent("applied");
  };

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
          {TYPE_LABELS[action.type]}
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
      {(action.type === "plan_create" || action.type === "plan_update") && (
        <PlanActionPreview action={action} />
      )}
      <div className="flex items-center gap-1.5">
        {state === "pending" && (
          <>
            <Button
              size="xs"
              onClick={onApply}
              type="button"
              loading={plan.pending}
            >
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
            {!isPlanAction && (
              <Button size="xs" variant="ghost" onClick={onApply} type="button">
                <RotateCcw size={12} />
                Re-apply
              </Button>
            )}
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
