import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Paginator } from "@/components/paginator";
import {
  DataTable,
  loadingRowCount,
  TwoLineCellSkeleton,
  type DataTableColumn,
} from "@/components/data-table";
import { CellText } from "@/components/cell-text";
import { Plus, Search, ShieldCheck, ShieldOff } from "lucide-react";
import { keepPreviousData } from "@tanstack/react-query";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import { formatFullDate, formatRelativeDate } from "@/features/admin/format";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { RemoveExemptionModal } from "./modals/RemoveExemptionModal";

type Exemption =
  RouterOutput["admin"]["inactivity"]["exemptions"]["list"]["exemptions"][number];

function toIso(value: string | Date): string {
  return typeof value === "string" ? value : new Date(value).toISOString();
}

export function ExemptionsCard({
  onWarningsChanged,
}: {
  onWarningsChanged: () => void;
}) {
  const [page, setPage] = useState(0);
  const [limit] = useState(20);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery, 500);

  const [playerInput, setPlayerInput] = useState("");
  const [reasonInput, setReasonInput] = useState("");
  const [removeTarget, setRemoveTarget] = useState<Exemption | null>(null);

  const listQuery = trpc.admin.inactivity.exemptions.list.useQuery(
    {
      search: debouncedSearch.trim() || undefined,
      page,
      limit,
    },
    { placeholderData: keepPreviousData },
  );

  const { refetch: refetchList } = listQuery;

  const addExemption = trpc.admin.inactivity.exemptions.add.useMutation(
    useMutationToast({
      success: (data) =>
        data.resolvedWarnings > 0
          ? `${data.minecraftUsername} exempted, ${data.resolvedWarnings} active warning(s) resolved`
          : `${data.minecraftUsername} exempted`,
      onSuccess: (data) => {
        setPlayerInput("");
        setReasonInput("");
        setPage(0);
        refetchList();
        if (data.resolvedWarnings > 0) onWarningsChanged();
      },
    }),
  );

  const exemptions = listQuery.data?.exemptions ?? [];
  const total = listQuery.data?.pagination.total ?? 0;
  const totalPages = listQuery.data?.pagination.totalPages ?? 0;
  const loading = listQuery.isLoading || listQuery.isPlaceholderData;
  const loadingRows = loadingRowCount(page, limit, total);
  const error = listQuery.error?.message ?? null;

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(e.target.value);
      setPage(0);
    },
    [],
  );

  const handleAdd = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const player = playerInput.trim();
      if (!player) return;
      addExemption.mutate({ player, reason: reasonInput.trim() || undefined });
    },
    [addExemption, playerInput, reasonInput],
  );

  const handleRemoveSuccess = useCallback(() => {
    setRemoveTarget(null);
    refetchList();
  }, [refetchList]);

  const columns: DataTableColumn<Exemption>[] = [
    {
      key: "player",
      header: "Player",
      minWidth: 200,
      skeleton: () => <TwoLineCellSkeleton />,
      render: (exemption) => (
        <div className="min-w-0">
          <CellText
            copy
            value={exemption.minecraftUsername}
            className="font-medium"
          />
          <CellText
            copy
            value={exemption.playerMinecraftUuid}
            display={`${exemption.playerMinecraftUuid.slice(0, 8)}…`}
            className="font-mono text-xs text-muted-foreground"
          />
        </div>
      ),
    },
    {
      key: "reason",
      header: "Reason",
      minWidth: 200,
      cellClassName: "text-sm",
      render: (exemption) =>
        exemption.reason ? (
          <CellText value={exemption.reason} />
        ) : (
          <p className="italic text-muted-foreground">No reason given</p>
        ),
    },
    {
      key: "addedBy",
      header: "Added By",
      width: 160,
      cellClassName: "text-sm",
      render: (exemption) =>
        exemption.createdByMinecraftUsername ? (
          <CellText value={exemption.createdByMinecraftUsername} />
        ) : (
          <p className="italic text-muted-foreground">Unknown</p>
        ),
    },
    {
      key: "added",
      header: "Added",
      width: 140,
      cellClassName: "text-sm text-muted-foreground",
      render: (exemption) => {
        const iso = toIso(exemption.createdAt);
        return (
          <CellText
            value={formatFullDate(iso)}
            display={formatRelativeDate(iso)}
          />
        );
      },
    },
    {
      key: "lastSeen",
      header: "Last Seen",
      width: 140,
      cellClassName: "text-sm text-muted-foreground",
      render: (exemption) => {
        const iso = toIso(exemption.lastSeen);
        return (
          <CellText
            value={formatFullDate(iso)}
            display={formatRelativeDate(iso)}
          />
        );
      },
    },
  ];

  return (
    <>
      <Card className="gap-0">
        <CardHeader className="border-b">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-muted-foreground" />
              Inactivity Exemptions
            </CardTitle>
            <CardDescription className="mt-1">
              Players on this list are never warned or removed by the inactivity
              sweep. Adding a player also closes any warning they currently
              have.
            </CardDescription>
          </div>

          <form onSubmit={handleAdd} className="mt-3 flex flex-wrap gap-2">
            <Input
              type="text"
              placeholder="Minecraft username, UUID, or Discord ID"
              value={playerInput}
              onChange={(e) => setPlayerInput(e.target.value)}
              className="min-w-72 flex-1"
              required
            />
            <Input
              type="text"
              placeholder="Reason (optional)"
              value={reasonInput}
              onChange={(e) => setReasonInput(e.target.value)}
              maxLength={500}
              className="min-w-48 flex-1"
            />
            <Button
              type="submit"
              className="min-w-[85px]"
              loading={addExemption.isPending}
            >
              <Plus className="mr-2 size-4" />
              Add
            </Button>
          </form>

          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by Minecraft username..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="pl-9"
            />
          </div>
        </CardHeader>

        {error ? (
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <p className="text-destructive">{error}</p>
              <Button
                onClick={() => listQuery.refetch()}
                className="mt-4"
                variant="outline"
              >
                Try Again
              </Button>
            </div>
          </CardContent>
        ) : !loading && exemptions.length === 0 ? (
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <ShieldCheck className="mx-auto size-12 text-muted-foreground" />
              <p className="mt-2 text-muted-foreground">
                {debouncedSearch.trim()
                  ? "No exempt players match your search"
                  : "No exempt players"}
              </p>
            </div>
          </CardContent>
        ) : (
          <>
            <CardContent className="px-0">
              <DataTable
                columns={columns}
                rows={exemptions}
                loading={loading}
                loadingRows={loadingRows}
                rowKey={(exemption) => exemption.playerMinecraftUuid}
                actions={(exemption) => [
                  {
                    label: "Remove exemption",
                    icon: ShieldOff,
                    variant: "destructive",
                    onClick: () => setRemoveTarget(exemption),
                  },
                ]}
                actionSlots={1}
              />
            </CardContent>

            {total > 0 && (
              <CardFooter className="border-t">
                <Paginator
                  page={page}
                  limit={limit}
                  total={total}
                  totalPages={totalPages}
                  onPageChange={setPage}
                  itemLabel="exemption"
                  className="w-full"
                />
              </CardFooter>
            )}
          </>
        )}
      </Card>

      <RemoveExemptionModal
        exemption={removeTarget}
        onClose={() => setRemoveTarget(null)}
        onSuccess={handleRemoveSuccess}
      />
    </>
  );
}
