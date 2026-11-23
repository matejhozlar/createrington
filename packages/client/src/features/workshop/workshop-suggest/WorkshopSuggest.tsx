import { useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { formatDate } from "@createrington/shared/format";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/query-states";
import { loaderName } from "@/features/workshop/format";
import { useWorkshopBySlug } from "@/features/workshop/hooks/use-workshop-by-slug";
import { PackStrip } from "@/features/workshop/components/PackStrip";
import {
  WorkshopPageHeader,
  WorkshopPageShell,
} from "@/features/workshop/components/WorkshopPageShell";
import { ActiveSlots } from "./components/ActiveSlots";
import { ModSearch } from "./components/ModSearch";
import { SuggestionHistory } from "./components/SuggestionHistory";

export function WorkshopSuggest() {
  const { slug, workshopId, gate } = useWorkshopBySlug("Loading workshop...");
  const [searchParams] = useSearchParams();

  const suggestionsQuery = useQuery(
    trpc.user.workshops.mySuggestions.queryOptions(
      { workshopId: workshopId! },
      { enabled: workshopId !== undefined },
    ),
  );
  const packQuery = useQuery(
    trpc.user.workshops.getPack.queryOptions(
      { workshopId: workshopId! },
      { enabled: workshopId !== undefined },
    ),
  );
  const suggestBanQuery = useQuery(
    trpc.user.workshops.mySuggestBan.queryOptions(
      { workshopId: workshopId! },
      { enabled: workshopId !== undefined },
    ),
  );

  const page = gate({
    failOn: [suggestionsQuery],
    waitFor: [suggestBanQuery],
  });
  if (!page.data) return page.fallback;

  const { workshop } = page.data;
  const isOpen = workshop.status === "open";
  const suggestBan = suggestBanQuery.data;
  const suggestions = suggestionsQuery.data ?? [];
  const packMods = packQuery.data?.mods ?? [];
  const packProjectIds = new Set(
    packMods.map((row) => row.curseforgeProjectId),
  );

  return (
    <WorkshopPageShell
      heroClassName="h-[260px]"
      backTo={`/workshop/${slug}`}
      backLabel={`Back to ${workshop.name}`}
    >
      <WorkshopPageHeader
        title="Suggest mods"
        description="Find a mod on CurseForge and tell us why it belongs in the pack. The team reviews every suggestion. Upvotes are the signal, not the verdict."
      />

      {packQuery.error ? (
        <div className="mt-7">
          <ErrorState
            bordered
            compact
            message={packQuery.error.message}
            onRetry={() => packQuery.refetch()}
          />
        </div>
      ) : (
        <PackStrip slug={slug} mods={packMods} className="mt-7">
          <span className="text-[13px] font-semibold whitespace-nowrap">
            {workshop.name}
          </span>
          <Badge variant="outline">{workshop.gameVersion}</Badge>
          <Badge variant="outline">{loaderName(workshop.modLoaderType)}</Badge>
        </PackStrip>
      )}

      <main className="mt-10 flex flex-col gap-12">
        {!isOpen ? (
          <section>
            <h2 className="text-2xl font-semibold">Find a mod</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              This workshop is closed for suggestions.
            </p>
          </section>
        ) : suggestBan ? (
          <section>
            <h2 className="text-2xl font-semibold">Find a mod</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              You are blocked from suggesting mods{" "}
              {suggestBan.global ? "across every workshop" : "in this workshop"}{" "}
              {suggestBan.expiresAt
                ? `until ${formatDate(suggestBan.expiresAt)}`
                : "permanently"}
              . Reason: {suggestBan.reason}
            </p>
          </section>
        ) : (
          <ModSearch
            workshop={workshop}
            suggestions={suggestions}
            packProjectIds={packProjectIds}
            initialQuery={searchParams.get("q") ?? ""}
          />
        )}

        <ActiveSlots
          workshop={workshop}
          suggestions={suggestions}
          isOpen={isOpen}
        />

        <SuggestionHistory />
      </main>
    </WorkshopPageShell>
  );
}
