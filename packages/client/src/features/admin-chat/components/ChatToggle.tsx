import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatToggleProps {
  open: boolean;
  unread: boolean;
  onToggle: () => void;
}

export function ChatToggle({
  open,
  unread,
  onToggle,
}: ChatToggleProps): React.JSX.Element {
  return (
    <button
      onClick={onToggle}
      title="Createrington Assistant (Ctrl+I to toggle)"
      aria-label={open ? "Close assistant" : "Open assistant"}
      className={cn(
        "relative flex size-12 items-center justify-center overflow-hidden rounded-full bg-primary text-primary-foreground shadow-lg transition-transform",
        "hover:scale-110 active:scale-95",
        "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
      )}
    >
      {open ? (
        <X size={20} />
      ) : (
        <img
          src="/assets/logo/createrington-bot.webp"
          alt="Createrington Assistant"
          className="size-full object-cover"
          loading="lazy"
        />
      )}
      {unread && !open && (
        <span
          className="absolute top-1 right-1 size-2.5 animate-pulse rounded-full border-2 border-card bg-destructive"
          aria-label="New message"
        />
      )}
    </button>
  );
}
