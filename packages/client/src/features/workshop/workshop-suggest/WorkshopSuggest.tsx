import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { NotFound } from "@/pages/not-found";
import { loaderName } from "../format";
import { ProjectThumb } from "../components/ProjectThumb";
import { ActiveSlots } from "./components/ActiveSlots";
import { ModSearch } from "./components/ModSearch";
import { SuggestionHistory } from "./components/SuggestionHistory";

const HERO_IMAGE = "/assets/hero/royal-albert-hall.webp";

export function WorkshopSuggest() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();

  const workshopQuery = trpc.user.workshops.get.useQuery(
    { slug: slug! },
    { enabled: !!slug, retry: false },
  );
  const workshopId = workshopQuery.data?.workshop.id;

  const suggestionsQuery = trpc.user.workshops.mySuggestions.useQuery(
    { workshopId: workshopId! },
    { enabled: workshopId !== undefined },
  );
  const packQuery = trpc.user.workshops.pack.useQuery(
    { workshopId: workshopId! },
    { enabled: workshopId !== undefined },
  );

  if (workshopQuery.error?.data?.code === "NOT_FOUND") {
    return <NotFound />;
  }

  if (workshopQuery.isLoading || !workshopQuery.data) {
    return (
      <div className="px-5 py-10 md:px-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  const { workshop } = workshopQuery.data;
  const isOpen = workshop.status === "open";
  const suggestions = suggestionsQuery.data ?? [];
  const packMods = packQuery.data ?? [];
  const packProjectIds = new Set(
    packMods.map((row) => row.curseforgeProjectId),
  );
  const packShown = packMods.slice(0, 4);
  const packExtra = packMods.length - packShown.length;

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-[260px] overflow-hidden">
        <img
          src={HERO_IMAGE}
          alt=""
          className="h-full w-full object-cover grayscale-50"
        />
        <div className="absolute inset-0 bg-black/30" />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, var(--background) 0%, oklch(from var(--background) l c h / 0.85) 45%, oklch(from var(--background) l c h / 0.4) 100%)",
          }}
        />
      </div>

      <div className="relative mx-auto max-w-6xl px-5 pt-8 pb-16 md:px-8">
        <Link
          to={`/workshop/${slug}`}
          className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-[15px]" />
          Back to {workshop.name}
        </Link>

        <header className="mt-5 max-w-[640px]">
          <h1 className="text-[34px] leading-10 font-bold text-shadow-[0_2px_8px_rgb(0_0_0/0.4)]">
            Suggest mods
          </h1>
          <p className="mt-2.5 text-[15px] leading-6 text-zinc-200 text-shadow-[0_1px_4px_rgb(0_0_0/0.4)]">
            Find a mod on CurseForge and tell us why it belongs in the pack. The
            team reviews every suggestion — upvotes are the signal, not the
            verdict.
          </p>
        </header>

        <Link to={`/workshop/${slug}`} className="mt-7 block text-inherit">
          <div className="flex flex-wrap items-center gap-3.5 rounded-xl border border-border bg-accent/15 px-5 py-3.5 transition-colors hover:border-primary/40">
            <span className="text-[13px] font-semibold whitespace-nowrap">
              {workshop.name}
            </span>
            <Badge variant="outline">{workshop.gameVersion}</Badge>
            <Badge variant="outline">
              {loaderName(workshop.modLoaderType)}
            </Badge>
            {packMods.length > 0 && (
              <span className="flex items-center gap-1.5">
                {packShown.map((mod) => (
                  <ProjectThumb
                    key={mod.id}
                    name={mod.project.name}
                    thumbnailUrl={mod.project.thumbnailUrl}
                    className="size-8 rounded-lg text-[10px]"
                  />
                ))}
                {packExtra > 0 && (
                  <span className="flex size-8 items-center justify-center rounded-lg bg-secondary text-[10px] font-semibold text-muted-foreground">
                    +{packExtra}
                  </span>
                )}
              </span>
            )}
          </div>
        </Link>

        <main className="mt-11 flex flex-col gap-12">
          {isOpen ? (
            <ModSearch
              workshop={workshop}
              suggestions={suggestions}
              packProjectIds={packProjectIds}
              initialQuery={searchParams.get("q") ?? ""}
            />
          ) : (
            <section>
              <h2 className="text-[22px] leading-7 font-semibold">
                Find a mod
              </h2>
              <p className="mt-1.5 text-[13px] text-muted-foreground">
                This workshop is closed for suggestions.
              </p>
            </section>
          )}

          <ActiveSlots
            workshop={workshop}
            suggestions={suggestions}
            isOpen={isOpen}
          />

          <SuggestionHistory />
        </main>
      </div>
    </div>
  );
}
