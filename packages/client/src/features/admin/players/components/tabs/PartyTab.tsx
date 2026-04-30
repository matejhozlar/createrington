import { Link } from "react-router-dom";
import { ExternalLink, MapPin } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Loading } from "@/components/loading-spinner";
import { ChunkTable } from "@/features/admin/tools/parties/components/ChunkTable";
import { PartyExpandedRow } from "@/features/admin/tools/parties/components/PartyExpandedRow";
import { AllyStatusSection } from "../AllyStatusSection";

// TODO: restore server selector when multi-server support returns
const SERVER_ID = 1;

interface PartyTabProps {
  playerUuid: string;
}

export function PartyTab({ playerUuid }: PartyTabProps) {
  const statusQuery = trpc.admin.parties.playerStatus.useQuery({
    serverId: SERVER_ID,
    playerUuid,
  });
  const playerChunksQuery = trpc.admin.parties.playerChunks.useQuery({
    serverId: SERVER_ID,
    playerUuid,
  });

  const partyAlliance = statusQuery.data?.partyAlliance ?? null;
  const soloChunks = playerChunksQuery.data ?? [];

  return (
    <div className="space-y-6">
      <AllyStatusSection playerUuid={playerUuid} />

      <PartyDetailsSection
        loading={statusQuery.isLoading}
        partyAlliance={partyAlliance}
      />

      <ForceloadSection
        loading={playerChunksQuery.isLoading}
        chunks={soloChunks}
      />
    </div>
  );
}

function PartyDetailsSection({
  loading,
  partyAlliance,
}: {
  loading: boolean;
  partyAlliance: { partyId: string; partyName: string | null } | null;
}) {
  if (loading) {
    return (
      <div>
        <h3 className="text-lg font-semibold">Party Details</h3>
        <div className="mt-4 rounded-lg border border-border p-4">
          <Loading size="small" />
        </div>
      </div>
    );
  }

  if (!partyAlliance) {
    return (
      <div>
        <h3 className="text-lg font-semibold">Party Details</h3>
        <p className="mt-4 text-sm text-muted-foreground">
          This player is not in an allied party.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-lg font-semibold">
          {partyAlliance.partyName ?? "Allied party"}
        </h3>
        <Link
          to="/admin/tools/parties"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          View in Parties admin
          <ExternalLink className="size-3" />
        </Link>
      </div>
      <p className="font-mono text-xs text-muted-foreground">
        {partyAlliance.partyId}
      </p>
      <div className="mt-4 rounded-lg border border-border p-4">
        <PartyExpandedRow
          serverId={SERVER_ID}
          partyUuid={partyAlliance.partyId}
          dimensionFilter="all"
          activeOnly={false}
        />
      </div>
    </div>
  );
}

function ForceloadSection({
  loading,
  chunks,
}: {
  loading: boolean;
  chunks: {
    id: number;
    dimension: string;
    x: number;
    z: number;
    active: boolean;
  }[];
}) {
  if (loading) {
    return (
      <div>
        <h3 className="text-lg font-semibold">Solo Forceloads</h3>
        <div className="mt-4 rounded-lg border border-border p-4">
          <Loading size="small" />
        </div>
      </div>
    );
  }

  if (chunks.length === 0) {
    return (
      <div>
        <h3 className="text-lg font-semibold">Solo Forceloads</h3>
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="size-4" />
          This player has no solo forceload chunks.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-semibold">Solo Forceloads</h3>
      <div className="mt-4 rounded-lg border border-border p-4">
        <ChunkTable chunks={chunks} dimensionFilter="all" activeOnly={false} />
      </div>
    </div>
  );
}
