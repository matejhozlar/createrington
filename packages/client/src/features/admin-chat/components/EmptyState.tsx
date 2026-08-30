import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ModelChip } from "./ModelChip";
import { readingColumnClass, type ChatLayout } from "../layout";
import type { AdminChatModel } from "../types";

const QUICK_PROMPTS: string[] = [
  "Find a player by Minecraft username",
  "Summarize recent bans this week",
  "Explain how playtime tracking works",
  "Help me debug a failing route",
];

interface EmptyStateProps {
  layout: ChatLayout;
  starting: boolean;
  onStart: (prefillMessage?: string) => void;
  selectedModel: AdminChatModel;
  onSelectModel: (model: AdminChatModel) => void;
}

export function EmptyState({
  layout,
  starting,
  onStart,
  selectedModel,
  onSelectModel,
}: EmptyStateProps): React.JSX.Element {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-4 px-6 py-8 text-center",
        readingColumnClass(layout),
      )}
    >
      <div className="flex size-12 items-center justify-center overflow-hidden rounded-full bg-primary/15">
        <img
          src="/assets/logo/createrington-bot.webp"
          alt="Createrington Assistant"
          className="size-full object-cover"
          loading="lazy"
        />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-foreground">
          Createrington Assistant
        </p>
        <p className="text-xs text-muted-foreground">
          Ask about players, database state, or report bugs.
        </p>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Button
          size="sm"
          onClick={() => onStart()}
          disabled={starting}
          className="min-w-32"
        >
          {starting && <Loader2 size={14} className="animate-spin" />}
          Start chat
        </Button>
        <ModelChip
          value={selectedModel}
          onChange={onSelectModel}
          disabled={starting}
        />
      </div>
      <div className="flex w-full flex-col gap-1.5 pt-2">
        <span className="text-[0.625rem] font-semibold tracking-wider text-muted-foreground uppercase">
          Try asking
        </span>
        <div className="flex flex-wrap justify-center gap-1.5">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => onStart(prompt)}
              disabled={starting}
              className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[0.6875rem] text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/10 hover:text-foreground disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
