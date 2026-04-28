import { Handshake } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function AlliesEmptyState() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-4 py-16">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <Handshake className="size-6 text-muted-foreground" />
        </div>
        <div className="flex flex-col items-center gap-1 text-center">
          <p className="text-sm font-medium">No ally data yet</p>
          <p className="text-xs text-muted-foreground">
            The opac-fakeplayer mod has not synced any ally state for this
            server.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
