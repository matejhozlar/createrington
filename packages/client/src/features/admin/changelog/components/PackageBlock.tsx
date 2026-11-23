import { pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ChangeTag } from "@/features/admin/components/ChangeTag";
import {
  classifyEntry,
  rangeBump,
  type ChangeKind,
  type PackageEntry,
} from "@/features/admin/changelog/parse";

const TAG_META: Record<ChangeKind, { label: string; color: string }> = {
  add: { label: "New", color: "var(--c-add)" },
  fix: { label: "Fix", color: "var(--c-fix)" },
  refactor: { label: "Refactor", color: "var(--c-refactor)" },
  remove: { label: "Remove", color: "var(--c-remove)" },
  security: { label: "Security", color: "var(--c-security)" },
  chore: { label: "Chore", color: "var(--c-chore)" },
  tweak: { label: "Polish", color: "var(--c-tweak)" },
  change: { label: "Change", color: "var(--c-change)" },
};

export function PackageBlock({ entry }: { entry: PackageEntry }) {
  const bump = rangeBump(entry.versionRange);
  return (
    <section className="border-b border-dashed border-border py-4 last:border-b-0 last:pb-1">
      <header className="mb-3 flex items-center gap-3 pb-0.5">
        <div className="flex flex-1 items-center gap-2.5">
          <span className="size-1.5 rounded-full bg-muted-foreground/60" />
          <h3 className="m-0 font-mono text-[13px] font-medium tracking-[-0.005em] text-foreground">
            {entry.name}
          </h3>
          {entry.versionRange && (
            <span
              className={cn(
                "rounded-[5px] border border-border bg-white/[0.04] px-[7px] py-px font-mono text-[11px] text-muted-foreground",
                bump === "major" && "border-primary-dim text-primary",
                (bump === "minor" || bump === "new") &&
                  "border-c-add/30 text-c-add",
              )}
            >
              {entry.versionRange}
            </span>
          )}
        </div>
        <span className="font-mono text-[11px] text-muted-foreground">
          {pluralize(entry.items.length, "change")}
        </span>
      </header>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {entry.items.map((raw, i) => {
          const { kind, text } = classifyEntry(raw);
          return (
            <li
              key={i}
              className="grid grid-cols-[auto_1fr] items-start gap-3 rounded-lg px-2 py-2 text-[13.5px] leading-[1.55] text-muted-foreground transition-colors hover:bg-white/[0.025] hover:text-foreground"
            >
              <ChangeTag {...TAG_META[kind]} />
              <span style={{ textWrap: "pretty" }}>
                <EntryText text={text} />
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function EntryText({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("`") && p.endsWith("`") ? (
          <code
            key={i}
            className="whitespace-nowrap rounded-[5px] border border-border bg-white/[0.06] px-1.5 py-px font-mono text-[0.86em] text-foreground"
          >
            {p.slice(1, -1)}
          </code>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}
