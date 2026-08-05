import { AlignJustify, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";

export type ViewMode = "list" | "grid";

export function ViewToggle({
  view,
  onChange,
}: {
  view: ViewMode;
  onChange: (view: ViewMode) => void;
}) {
  return (
    <div className="flex h-9 shrink-0 overflow-hidden rounded-lg border border-border">
      <ViewButton
        active={view === "list"}
        label="List view"
        onClick={() => onChange("list")}
      >
        <AlignJustify className="size-4" />
      </ViewButton>
      <ViewButton
        active={view === "grid"}
        label="Grid view"
        onClick={() => onChange("grid")}
      >
        <LayoutGrid className="size-4" />
      </ViewButton>
    </div>
  );
}

function ViewButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "flex w-10 cursor-pointer items-center justify-center transition-colors",
        active
          ? "bg-[var(--primary-glow)] text-primary"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
