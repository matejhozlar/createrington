import type { ReactNode } from "react";
import { Link } from "lucide-react";
import { Button } from "@/components/ui/button";

const INSTRUCTIONS = [
  "Copy your code.",
  "Give your Team Prefix License to an admin in game.",
  "Send them the code. They set it for your party, and every member gets the plate.",
];

export function SendStep({
  code,
  settings,
  onCopyLink,
}: {
  code: string | null;
  settings: ReactNode;
  onCopyLink: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      {settings}
      <div className="flex flex-col gap-3.5 rounded-xl border bg-card p-4">
        <div className="flex min-h-8 items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Your design code
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCopyLink}
            disabled={!code}
          >
            <Link />
            Copy link
          </Button>
        </div>
        <output
          aria-live="polite"
          className="font-mono text-[15px]/[22px] break-all select-all"
        >
          {code ?? (
            <span className="font-sans text-sm text-muted-foreground">
              Finish the tag to get your code.
            </span>
          )}
        </output>
      </div>
      <ol className="flex flex-col gap-3">
        {INSTRUCTIONS.map((step, i) => (
          <li key={step} className="flex gap-3 text-sm">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
              {i + 1}
            </span>
            <span className="text-pretty text-muted-foreground">{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
