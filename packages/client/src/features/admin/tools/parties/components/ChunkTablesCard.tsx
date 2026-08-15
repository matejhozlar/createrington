import { useState } from "react";
import { Users, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChunkPartiesTable } from "./ChunkPartiesTable";
import type { ChunkParty } from "./ChunkPartiesTable";
import { ChunkSoloPlayersSection } from "./ChunkSoloPlayersSection";
import type {
  SoloPlayersData,
  SoloSortKey,
  SoloSortState,
} from "./ChunkSoloPlayersSection";
import type { PartyFilters } from "../types";

export function ChunkTablesCard({
  serverId,
  filteredParties,
  totalParties,
  filters,
  soloPlayersEnabled,
  soloData,
  soloIsLoading,
  onSoloPageChange,
  soloSort,
  onSoloSortChange,
  initialExpandedPartyId,
}: {
  serverId: number;
  filteredParties: ChunkParty[];
  totalParties: number;
  filters: PartyFilters;
  soloPlayersEnabled: boolean;
  soloData: SoloPlayersData | undefined;
  soloIsLoading: boolean;
  onSoloPageChange: (page: number) => void;
  soloSort: SoloSortState;
  onSoloSortChange: (key: SoloSortKey) => void;
  initialExpandedPartyId?: string | null;
}) {
  const [tab, setTab] = useState<string>("parties");

  // If the solo tab is active but becomes disabled, switch back to parties
  if (tab === "solo" && !soloPlayersEnabled) {
    setTab("parties");
  }

  const soloTotal = soloData?.pagination.total ?? 0;

  return (
    <Card className="gap-0">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mx-4 mt-3">
          <TabsTrigger value="parties">
            <Users className="size-4" />
            Parties ({filteredParties.length}
            {filteredParties.length !== totalParties && ` of ${totalParties}`})
          </TabsTrigger>
          {soloPlayersEnabled ? (
            <TabsTrigger value="solo">
              <User className="size-4" />
              Solo players ({soloIsLoading ? "\u2026" : soloTotal})
            </TabsTrigger>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <TabsTrigger value="solo" disabled>
                    <User className="size-4" />
                    Solo players
                  </TabsTrigger>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                Not available with the current filters
              </TooltipContent>
            </Tooltip>
          )}
        </TabsList>

        <TabsContent
          value="parties"
          className="@container @min-[1100px]:[&>div>[data-slot=table-container]]:overflow-x-clip"
        >
          <ChunkPartiesTable
            serverId={serverId}
            parties={filteredParties}
            totalParties={totalParties}
            filters={filters}
            initialExpandedPartyId={initialExpandedPartyId}
          />
        </TabsContent>

        <TabsContent value="solo">
          <ChunkSoloPlayersSection
            serverId={serverId}
            data={soloData}
            isLoading={soloIsLoading}
            onPageChange={onSoloPageChange}
            dimensionFilter={filters.dimension}
            activeOnly={filters.activeForceloadsOnly}
            sort={soloSort}
            onSortChange={onSoloSortChange}
          />
        </TabsContent>
      </Tabs>
    </Card>
  );
}
