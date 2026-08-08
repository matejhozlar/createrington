import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Loading } from "@/components/loading-spinner";
import { NotFound } from "@/pages/not-found";
import { loaderName } from "../format";
import { PackStrip } from "../components/PackStrip";
import { QueryErrorState } from "../components/QueryErrorState";
import { WorkshopDisabledState } from "../components/WorkshopEmptyState";
import { WorkshopHero } from "../components/WorkshopHero";
import { ActiveSlots } from "./components/ActiveSlots";
import { ModSearch } from "./components/ModSearch";
import { SuggestionHistory } from "./components/SuggestionHistory";

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
  const packQuery = trpc.user.workshops.getPack.useQuery(
    { workshopId: workshopId! },
    { enabled: workshopId !== undefined },
  );

  if (workshopQuery.error?.data?.code === "NOT_FOUND") {
    return <NotFound />;
  }

  const pageError = workshopQuery.error ?? suggestionsQuery.error;
  if (pageError) {
    return (
      <div className="px-5 py-10 md:px-8">
        <div className="mx-auto max-w-6xl">
          {pageError.data?.code === "FORBIDDEN" ? (
            <WorkshopDisabledState />
          ) : (
            <QueryErrorState
              message={pageError.message}
              onRetry={() => {
                if (workshopQuery.error) workshopQuery.refetch();
                if (suggestionsQuery.error) suggestionsQuery.refetch();
              }}
            />
          )}
        </div>
      </div>
    );
  }

  if (
    workshopQuery.isLoading ||
    !workshopQuery.data ||
    suggestionsQuery.isLoading
  ) {
    return (
      <Loading size="large" className="py-32" text="Loading workshop..." />
    );
  }

  const { workshop } = workshopQuery.data;
  const isOpen = workshop.status === "open";
  const suggestions = suggestionsQuery.data ?? [];
  const packMods = packQuery.data?.mods ?? [];
  const packProjectIds = new Set(
    packMods.map((row) => row.curseforgeProjectId),
  );

  return (
    <div className="relative overflow-hidden">
      <WorkshopHero className="h-[260px]" />

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
            team reviews every suggestion. Upvotes are the signal, not the
            verdict.
          </p>
        </header>

        {packQuery.error ? (
          <div className="mt-7">
            <QueryErrorState
              compact
              message={packQuery.error.message}
              onRetry={() => packQuery.refetch()}
            />
          </div>
        ) : (
          <PackStrip slug={slug!} mods={packMods} className="mt-7">
            <span className="text-[13px] font-semibold whitespace-nowrap">
              {workshop.name}
            </span>
            <Badge variant="outline">{workshop.gameVersion}</Badge>
            <Badge variant="outline">
              {loaderName(workshop.modLoaderType)}
            </Badge>
          </PackStrip>
        )}

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
