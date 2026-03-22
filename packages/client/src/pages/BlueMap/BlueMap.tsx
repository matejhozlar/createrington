// TODO: Refactor to dynamically open the map for a configured server.
// TODO: Add backend routes to provide the map link per server.

import { useState } from "react";
import { useLocation } from "react-router-dom";
import { MapPinOff } from "lucide-react";

const BLUEMAP_URL = import.meta.env.VITE_BLUEMAP_URL as string;

export function BlueMap() {
  const location = useLocation();
  const [status, setStatus] = useState<"loading" | "available" | "unavailable">(
    "loading",
  );

  return (
    <div className="flex h-full w-full flex-1">
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-muted-foreground text-sm">Loading map...</div>
        </div>
      )}

      {status === "unavailable" && (
        <div className="flex h-full w-full flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-center">
            <MapPinOff className="text-muted-foreground h-12 w-12" />
            <h2 className="text-lg font-semibold">Map Unavailable</h2>
            <p className="text-muted-foreground max-w-sm text-sm">
              The BlueMap viewer is currently unavailable. The server may be
              offline or the map is not running.
            </p>
          </div>
        </div>
      )}

      {status !== "unavailable" && (
        <iframe
          src={`${BLUEMAP_URL}/${location.hash}`}
          title="BlueMap Viewer"
          className="h-full w-full flex-1 border-none"
          onLoad={() => setStatus("available")}
          onError={() => setStatus("unavailable")}
        />
      )}
    </div>
  );
}
