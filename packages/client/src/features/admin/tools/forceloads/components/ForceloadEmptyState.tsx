import { MapPin, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function ForceloadEmptyState({
  onResync,
  isResyncing,
}: {
  onResync: () => void;
  isResyncing: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-4 py-16">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <MapPin className="size-6 text-muted-foreground" />
        </div>
        <div className="flex flex-col items-center gap-1 text-center">
          <p className="text-sm font-medium">No forceloads on this server</p>
          <p className="text-xs text-muted-foreground">
            No solo-player or party chunks are currently tracked. Dispatch a
            sync to pull the latest state from the server.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onResync}
          disabled={isResyncing}
        >
          <RefreshCw
            className={`size-4 ${isResyncing ? "animate-spin" : ""}`}
          />
          Resync now
        </Button>
      </CardContent>
    </Card>
  );
}
