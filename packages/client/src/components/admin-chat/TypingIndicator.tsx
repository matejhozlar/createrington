import { Bot } from "lucide-react";

export function TypingIndicator(): React.JSX.Element {
  return (
    <div className="flex items-end gap-2 self-start">
      <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
        <Bot size={14} />
      </div>
      <div className="flex items-center gap-1 rounded-lg rounded-bl-sm bg-muted px-3 py-2.5">
        <span
          className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60"
          style={{ animationDelay: "0ms" }}
        />
        <span
          className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60"
          style={{ animationDelay: "120ms" }}
        />
        <span
          className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60"
          style={{ animationDelay: "240ms" }}
        />
      </div>
    </div>
  );
}
