import { useRef } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MentionMenu } from "./MentionMenu";
import { useMentions } from "../hooks/use-mentions";
import { readingColumnClass, type ChatLayout } from "../layout";

interface MessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  sending: boolean;
  layout: ChatLayout;
  disabled?: boolean;
}

export function MessageInput({
  value,
  onChange,
  onSubmit,
  sending,
  layout,
  disabled = false,
}: MessageInputProps): React.JSX.Element {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mentions = useMentions();

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    const next = e.target.value;
    onChange(next);
    mentions.onValueChange(next, e.target.selectionStart ?? next.length);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    // When the mention menu is open, arrow keys + Enter/Tab drive it
    // instead of navigating the textarea / submitting the message.
    if (mentions.mention && mentions.matches.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        mentions.setIndex((i) => (i + 1) % mentions.matches.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        mentions.setIndex(
          (i) => (i - 1 + mentions.matches.length) % mentions.matches.length,
        );
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        acceptMention(mentions.matches[mentions.index]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        mentions.clear();
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  const acceptMention = (repo: (typeof mentions.matches)[number]): void => {
    const result = mentions.acceptAt(repo, value);
    if (!result) return;
    onChange(result.value);
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(result.cursor, result.cursor);
    });
  };

  const canSend = !sending && value.trim().length > 0 && !disabled;

  return (
    <div className="shrink-0 border-t border-border px-3 py-2.5">
      <div
        className={cn(
          "relative flex items-end gap-2",
          readingColumnClass(layout),
        )}
      >
        <MentionMenu
          matches={mentions.matches}
          activeIndex={mentions.index}
          onSelect={acceptMention}
          onHover={mentions.setIndex}
        />
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onKeyUp={(e) => mentions.syncFromCursor(e.currentTarget)}
          onClick={(e) => mentions.syncFromCursor(e.currentTarget)}
          placeholder="Ask anything... (type @ for repo)"
          disabled={sending || disabled}
          rows={1}
          className={cn(
            "max-h-24 min-h-9 flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 leading-relaxed text-foreground outline-none focus:border-ring",
            layout === "fullscreen" ? "text-base" : "text-[0.8125rem]",
          )}
        />
        <Button
          size="icon"
          onClick={onSubmit}
          disabled={!canSend}
          aria-label="Send message"
          className="mb-1"
        >
          {sending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Send size={14} />
          )}
        </Button>
      </div>
    </div>
  );
}
