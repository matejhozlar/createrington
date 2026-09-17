import { Pin, type LucideIcon } from "lucide-react";

export function PinnedTools({
  tools,
  onOpen,
}: {
  tools: { title: string; href: string; icon: LucideIcon }[];
  onOpen: (href: string) => void;
}) {
  return (
    <section
      aria-label="Pinned tools"
      className="flex flex-col gap-2.25 rounded-xl border border-border bg-[color-mix(in_oklab,var(--primary)_5%,var(--card))] px-4 py-3.5"
    >
      <div className="flex items-center gap-1.75 text-[11.5px] font-bold uppercase tracking-[0.08em] text-primary">
        <Pin className="size-3.25" />
        Pinned
      </div>
      <div className="flex flex-wrap gap-2">
        {tools.map(({ title, href, icon: Icon }) => (
          <button
            key={href}
            type="button"
            onClick={() => onOpen(href)}
            className="flex h-9 cursor-pointer items-center gap-2.25 rounded-[9px] border border-primary/30 bg-card px-3 text-[13.5px] font-medium outline-none transition-colors hover:border-primary/60 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Icon className="size-4 text-primary" />
            {title}
          </button>
        ))}
      </div>
    </section>
  );
}
