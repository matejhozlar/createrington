import { cn } from "@/lib/utils";

export function DashedBox({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed border-[var(--border-strong)] px-6 py-10 text-center text-sm text-muted-foreground",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function WorkshopEmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <DashedBox className="flex flex-col items-center gap-3 py-16 text-base text-foreground">
      <div className="text-lg font-semibold">{title}</div>
      <p className="max-w-[400px] text-sm leading-[22px] text-muted-foreground">
        {description}
      </p>
    </DashedBox>
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
