import { useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, Search } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loading } from "@/components/loading-spinner";
import { NotFound } from "@/pages/not-found";
import { CurseForgeIcon } from "@/components/icons/curseforge";
import { isHttpUrl, loaderName, projectCategories } from "../format";
import { PAGE_SIZE, WORDMARK_IMAGE } from "../constants";
import { useViewMode } from "../hooks/use-view-mode";
import { QueryErrorState } from "../components/QueryErrorState";
import { ViewToggle } from "../components/ViewToggle";
import { WorkshopDisabledState } from "../components/WorkshopEmptyState";
import { WorkshopHero } from "../components/WorkshopHero";
import { PackList } from "./components/PackList";

const FALLBACK_DESCRIPTION =
  "Everything running on the server right now: the base pack plus every mod players have voted in.";

type SourceFilter = "all" | "voted" | "base";

const SOURCE_OPTIONS: Array<{ value: SourceFilter; label: string }> = [
  { value: "all", label: "All sources" },
  { value: "voted", label: "Voted in by players" },
  { value: "base", label: "Base pack" },
];

export function WorkshopPack() {
  const { slug } = useParams<{ slug: string }>();

  const [searchQuery, setSearchQuery] = useState("");
  const [source, setSource] = useState<SourceFilter>("all");
  const [category, setCategory] = useState("all");
  const [shownCount, setShownCount] = useState(PAGE_SIZE);
  const [view, changeView] = useViewMode("workshop-pack-view");

  const workshopQuery = trpc.user.workshops.get.useQuery(
    { slug: slug! },
    { enabled: !!slug, retry: false },
  );
  const workshopId = workshopQuery.data?.workshop.id;

  const packQuery = trpc.user.workshops.getPack.useQuery(
    { workshopId: workshopId! },
    { enabled: workshopId !== undefined },
  );

  if (workshopQuery.error?.data?.code === "NOT_FOUND") {
    return <NotFound />;
  }

  if (workshopQuery.error) {
    return (
      <div className="px-5 py-10 md:px-8">
        <div className="mx-auto max-w-6xl">
          {workshopQuery.error.data?.code === "FORBIDDEN" ? (
            <WorkshopDisabledState />
          ) : (
            <QueryErrorState
              message={workshopQuery.error.message}
              onRetry={() => workshopQuery.refetch()}
            />
          )}
        </div>
      </div>
    );
  }

  if (workshopQuery.isLoading || !workshopQuery.data) {
    return (
      <Loading size="large" className="py-32" text="Loading the pack..." />
    );
  }

  const { workshop } = workshopQuery.data;
  const modpack = packQuery.data?.modpack;
  const mods = packQuery.data?.mods ?? [];

  const query = searchQuery.trim().toLowerCase();
  const searching = query.length > 0;

  const categories = [
    ...new Set(
      mods.flatMap((mod) => projectCategories(mod.project.categories)),
    ),
  ].sort();

  let visible = [...mods].sort((a, b) =>
    a.project.name.localeCompare(b.project.name),
  );
  if (source === "voted") {
    visible = visible.filter((mod) => mod.origin === "suggestion");
  }
  if (source === "base") {
    visible = visible.filter((mod) => mod.origin !== "suggestion");
  }
  if (category !== "all") {
    visible = visible.filter((mod) =>
      projectCategories(mod.project.categories).includes(category),
    );
  }
  if (searching) {
    visible = visible.filter((mod) =>
      `${mod.project.name} ${mod.project.primaryAuthor ?? ""} ${mod.suggestedByName ?? ""}`
        .toLowerCase()
        .includes(query),
    );
  }

  const filtering = searching || source !== "all" || category !== "all";
  const shown = filtering ? visible.length : shownCount;
  const remaining = visible.length - shown;

  return (
    <div className="relative overflow-hidden">
      <WorkshopHero className="h-[340px]" />

      <div className="relative mx-auto max-w-6xl px-5 pt-8 pb-16 md:px-8">
        <Link
          to={`/workshop/${slug}`}
          className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-[15px]" />
          Back to the workshop
        </Link>

        <header className="mt-5 flex flex-wrap items-center justify-between gap-6">
          <div className="max-w-[620px] min-w-0">
            <div className="flex flex-wrap items-center gap-3.5">
              <h1 className="text-4xl font-semibold text-shadow-[0_2px_8px_rgb(0_0_0/0.4)]">
                The full pack
              </h1>
              <div className="flex gap-2">
                <Badge variant="outline">{workshop.gameVersion}</Badge>
                <Badge variant="outline">
                  {loaderName(workshop.modLoaderType)}
                </Badge>
              </div>
            </div>
            <p className="mt-4 max-w-2xl text-base text-zinc-200 text-shadow-[0_1px_4px_rgb(0_0_0/0.4)]">
              {modpack?.description ?? FALLBACK_DESCRIPTION}
            </p>
            {modpack && isHttpUrl(modpack.curseforgeUrl) && (
              <div className="mt-6">
                <Button size="lg" asChild>
                  <a
                    href={modpack.curseforgeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <CurseForgeIcon className="size-4" />
                    Get the pack on CurseForge
                  </a>
                </Button>
              </div>
            )}
          </div>
          <img
            src={WORDMARK_IMAGE}
            alt="Createrington"
            className="hidden w-[280px] drop-shadow-[0_6px_14px_rgb(0_0_0/0.55)] md:block"
          />
        </header>

        <main className="mt-10 flex flex-col gap-6">
          {packQuery.isLoading ? (
            <Loading size="medium" className="py-16" text="Loading mods..." />
          ) : packQuery.error ? (
            <QueryErrorState
              message={packQuery.error.message}
              onRetry={() => packQuery.refetch()}
            />
          ) : (
            <>
              <h2 className="text-2xl font-semibold">
                {filtering
                  ? `${visible.length} ${visible.length === 1 ? "mod" : "mods"}`
                  : `All ${mods.length} ${mods.length === 1 ? "mod" : "mods"}`}
              </h2>

              <div className="-mt-2 flex flex-wrap items-center gap-2.5">
                <div className="relative w-full min-w-0 flex-none sm:max-w-[420px] sm:min-w-[200px] sm:flex-1">
                  <Search className="pointer-events-none absolute top-1/2 left-2.5 size-[15px] -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(event) => {
                      setSearchQuery(event.target.value);
                      setShownCount(PAGE_SIZE);
                    }}
                    placeholder="Search the pack..."
                    className="h-9 rounded-lg bg-white/[0.03] pl-8 text-[13px]"
                  />
                </div>
                <span className="hidden flex-1 sm:block" />
                <Select
                  value={source}
                  onValueChange={(value) => {
                    setSource(value as SourceFilter);
                    setShownCount(PAGE_SIZE);
                  }}
                >
                  <SelectTrigger className="w-full sm:w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCE_OPTIONS.map(({ value, label }) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={category}
                  onValueChange={(value) => {
                    setCategory(value);
                    setShownCount(PAGE_SIZE);
                  }}
                >
                  <SelectTrigger className="w-full sm:w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {categories.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <ViewToggle view={view} onChange={changeView} />
              </div>

              {visible.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--border-strong)] px-6 py-10 text-center text-sm text-muted-foreground">
                  {filtering
                    ? "No mods match your search."
                    : "Nothing in the pack yet."}
                </div>
              ) : (
                <PackList mods={visible.slice(0, shown)} view={view} />
              )}

              {remaining > 0 && (
                <div className="-mt-1 flex justify-center">
                  <Button
                    variant="secondary"
                    onClick={() => setShownCount(shown + PAGE_SIZE)}
                  >
                    Show {Math.min(remaining, PAGE_SIZE)} more
                  </Button>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
