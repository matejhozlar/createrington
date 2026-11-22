import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CardDescription, CardTitle } from "@/components/ui/card";
import { SearchInput } from "@/components/search-input";
import { Input } from "@/components/ui/input";
import { TableCard } from "@/components/paged-table";
import {
  TwoLineCellSkeleton,
  type DataTableColumn,
} from "@/components/data-table";
import { CellDate, CellText } from "@/components/cell-text";
import { Plus, ShieldCheck, ShieldOff } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import { usePagedQuery } from "@/hooks/use-paged-query";
import { trpc, queryClient, type RouterOutput } from "@/lib/trpc";
import { RemoveExemptionModal } from "./modals/RemoveExemptionModal";

type Exemption =
  RouterOutput["admin"]["inactivity"]["exemptions"]["list"]["items"][number];

export function ExemptionsCard() {
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery);

  const [playerInput, setPlayerInput] = useState("");
  const [reasonInput, setReasonInput] = useState("");
  const [removeTarget, setRemoveTarget] = useState<Exemption | null>(null);

  const exemptions = usePagedQuery(
    { search: debouncedSearch.trim() || undefined },
    (input) => trpc.admin.inactivity.exemptions.list.queryOptions(input),
  );

  const addExemption = useMutation(
    trpc.admin.inactivity.exemptions.create.mutationOptions(
      useMutationToast({
        success: (data) =>
          data.resolvedWarnings > 0
            ? `${data.minecraftUsername} exempted, ${data.resolvedWarnings} active warning(s) resolved`
            : `${data.minecraftUsername} exempted`,
        onSuccess: () => {
          setPlayerInput("");
          setReasonInput("");
          exemptions.setPage(0);
          void queryClient.invalidateQueries(
            trpc.admin.inactivity.pathFilter(),
          );
        },
      }),
    ),
  );

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const player = playerInput.trim();
    if (!player) return;
    addExemption.mutate({ player, reason: reasonInput.trim() || undefined });
  };

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
      render: (exemption) => <CellDate value={exemption.createdAt} relative />,
    },
    {
      key: "lastSeen",
      header: "Last Seen",
      width: 140,
      cellClassName: "text-sm text-muted-foreground",
      render: (exemption) => <CellDate value={exemption.lastSeen} relative />,
    },
  ];

  return (
    <>
      <TableCard
        header={
          <>
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="size-5 text-muted-foreground" />
                Inactivity Exemptions
              </CardTitle>
              <CardDescription className="mt-1">
                Players on this list are never warned or removed by the
                inactivity sweep. Adding a player also closes any warning they
                currently have.
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

            <SearchInput
              className="mt-3"
              placeholder="Search by Minecraft username..."
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
          </>
        }
        paged={exemptions}
        empty={{
          icon: ShieldCheck,
          message: debouncedSearch.trim()
            ? "No exempt players match your search"
            : "No exempt players",
        }}
        itemLabel="exemption"
        columns={columns}
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

      <RemoveExemptionModal
        exemption={removeTarget}
        onClose={() => setRemoveTarget(null)}
      />
    </>
  );
}
