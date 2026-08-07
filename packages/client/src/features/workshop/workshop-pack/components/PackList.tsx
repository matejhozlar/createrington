import type { ReactNode } from "react";
import type { RouterOutput } from "@/lib/trpc";
import { CurseForgeIcon } from "@/components/icons/curseforge";
import { PlayerLabel } from "@/components/player-label";
import { ProjectThumb } from "../../components/ProjectThumb";
import { projectCategories } from "../../format";

export type PackMod = RouterOutput["user"]["workshops"]["pack"]["mods"][number];

export function PackList({
  mods,
  view,
}: {
  mods: PackMod[];
  view: "list" | "grid";
}) {
  if (view === "grid") {
    return (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-3">
        {mods.map((mod) => (
          <PackCard key={mod.id} mod={mod} />
        ))}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {mods.map((mod) => (
        <PackRow key={mod.id} mod={mod} />
      ))}
    </div>
  );
}

function attribution(mod: PackMod): ReactNode {
  const name =
    mod.origin === "suggestion"
      ? mod.suggestedByName
      : mod.origin === "admin"
        ? mod.addedByName
        : null;
  if (!name) return null;
  return (
    <PlayerLabel
      name={name}
      playerId={mod.origin === "admin" ? mod.addedBy : null}
      size={16}
    />
  );
}

function PackRow({ mod }: { mod: PackMod }) {
  const credit = attribution(mod);
  const category = projectCategories(mod.project.categories)[0] ?? null;
  return (
    <div className="group flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-3.5 transition-colors hover:border-primary/40">
      <ProjectThumb
        name={mod.project.name}
        thumbnailUrl={mod.project.thumbnailUrl}
        className="size-11 rounded-[10px] text-[13px]"
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold">
          {mod.project.name}
        </div>
        {(mod.project.primaryAuthor || category) && (
          <div className="mt-[3px] truncate text-xs text-muted-foreground">
            {mod.project.primaryAuthor && `by ${mod.project.primaryAuthor}`}
            {mod.project.primaryAuthor && category && " · "}
            {category}
          </div>
        )}
      </div>
      {credit && (
        <span className="hidden shrink-0 text-xs text-muted-foreground sm:flex">
          {credit}
        </span>
      )}
      <CurseForgeLink url={mod.project.websiteUrl} />
    </div>
  );
}

function PackCard({ mod }: { mod: PackMod }) {
  const credit = attribution(mod);
  const category = projectCategories(mod.project.categories)[0] ?? null;
  return (
    <div className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-[18px] pb-5 transition-colors hover:border-primary/40">
      <div className="flex items-center gap-3">
        <ProjectThumb
          name={mod.project.name}
          thumbnailUrl={mod.project.thumbnailUrl}
          className="size-13 rounded-[10px] text-sm"
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold">
            {mod.project.name}
          </div>
          {mod.project.primaryAuthor && (
            <div className="mt-0.5 truncate text-xs text-muted-foreground">
              by {mod.project.primaryAuthor}
            </div>
          )}
        </div>
      </div>
      {mod.project.summary && (
        <p className="line-clamp-2 text-[13px] leading-[19px] text-muted-foreground">
          {mod.project.summary}
        </p>
      )}
      <div className="mt-auto flex items-center gap-1.5 overflow-hidden text-xs whitespace-nowrap text-muted-foreground">
        {category && <span>{category}</span>}
        {category && credit && <span>·</span>}
        {credit}
        <span className="flex-1" />
        <CurseForgeLink url={mod.project.websiteUrl} />
      </div>
    </div>
  );
}

function CurseForgeLink({ url }: { url: string | null }) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="View on CurseForge"
      title="View on CurseForge"
      className="shrink-0 text-muted-foreground opacity-35 transition-[color,opacity] group-hover:opacity-100 hover:text-[#F16436]"
    >
      <CurseForgeIcon className="size-5" />
    </a>
  );
}
