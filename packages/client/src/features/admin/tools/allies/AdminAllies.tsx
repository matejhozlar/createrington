import { trpc } from "@/lib/trpc";
import { Loading } from "@/components/loading-spinner";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { FakePartyCard } from "./components/FakePartyCard";
import { AlliedPartiesList } from "./components/AlliedPartiesList";
import { QualifiedPlayersList } from "./components/QualifiedPlayersList";
import { AlliesEmptyState } from "./components/AlliesEmptyState";

const SERVER_ID = 1;

export function AdminAllies() {
  const fakePartyQuery = trpc.admin.allies.fakeParty.useQuery({
    serverId: SERVER_ID,
  });
  const alliedPartiesQuery = trpc.admin.allies.alliedParties.useQuery({
    serverId: SERVER_ID,
  });
  const qualifiedQuery = trpc.admin.allies.qualifiedPlayers.useQuery({
    serverId: SERVER_ID,
  });

  const loading =
    fakePartyQuery.isLoading ||
    alliedPartiesQuery.isLoading ||
    qualifiedQuery.isLoading;

  const hasAnyData =
    !!fakePartyQuery.data ||
    (alliedPartiesQuery.data?.length ?? 0) > 0 ||
    (qualifiedQuery.data?.length ?? 0) > 0;

  return (
    <div className="flex flex-1 flex-col gap-4">
      <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border bg-sidebar px-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin/dashboard">Admin</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin/tools">Tools</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Allies</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-4 px-4 pb-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Allies</h1>
          <p className="text-sm text-muted-foreground">
            Fake-player party state synced from opac-fakeplayer.
          </p>
        </div>

        {loading ? (
          <Loading size="medium" text="Loading ally data..." />
        ) : !hasAnyData ? (
          <AlliesEmptyState />
        ) : (
          <>
            <FakePartyCard data={fakePartyQuery.data ?? null} />
            <AlliedPartiesList parties={alliedPartiesQuery.data ?? []} />
            <QualifiedPlayersList players={qualifiedQuery.data ?? []} />
          </>
        )}
      </div>
    </div>
  );
}
