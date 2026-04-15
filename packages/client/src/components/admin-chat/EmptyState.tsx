import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const QUICK_PROMPTS: string[] = [
  "Find a player by Minecraft username",
  "Summarize recent bans this week",
  "Explain how playtime tracking works",
  "Help me debug a failing route",
];

interface EmptyStateProps {
  starting: boolean;
  onStart: (prefillMessage?: string) => void;
}

export function EmptyState({
  starting,
  onStart,
}: EmptyStateProps): React.JSX.Element {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary">
        <Sparkles size={22} strokeWidth={1.75} />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-foreground">
          Createrington Assistant
        </p>
        <p className="text-xs text-muted-foreground">
          Ask about players, database state, or report bugs.
        </p>
      </div>
      <Button
        size="sm"
        onClick={() => onStart()}
        disabled={starting}
        className="min-w-32"
      >
        {starting && <Loader2 size={14} className="animate-spin" />}
        Start chat
      </Button>
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
