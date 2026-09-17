import { Kbd } from "@/components/ui/kbd";

const HINTS = [
  { keys: ["↑", "↓", "←", "→"], label: "move" },
  { keys: ["↵"], label: "open" },
  { keys: ["P"], label: "pin" },
  { keys: ["esc"], label: "clear" },
];

export function KeyboardHints() {
  return (
    <footer className="hidden border-t border-border bg-sidebar/70 py-2.5 text-xs text-muted-foreground md:block">
      <div className="mx-auto flex w-full max-w-[1200px] items-center gap-4 px-6">
        {HINTS.map(({ keys, label }) => (
          <span key={label} className="flex items-center gap-1.5">
            {keys.map((key) => (
              <Kbd key={key}>{key}</Kbd>
            ))}
            {label}
          </span>
        ))}
      </div>
    </footer>
  );
}
