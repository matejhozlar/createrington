import { Hammer } from "lucide-react";

export function WorkshopEmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-[var(--border-strong)] px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-lg bg-[var(--primary-glow)]">
        <Hammer className="size-[22px] text-primary" />
      </div>
      <div className="text-lg font-semibold">{title}</div>
      <p className="max-w-[400px] text-sm leading-[22px] text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

export function WorkshopDisabledState() {
  return (
    <WorkshopEmptyState
      title="The workshop is closed right now"
      description="Mod suggestions are paused for the moment. Check back later or keep an eye on the Discord announcements."
    />
  );
}
