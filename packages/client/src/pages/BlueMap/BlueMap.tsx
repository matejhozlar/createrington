// TODO: Refactor to dynamically open the map for a configured server.
// TODO: Add backend routes to provide the map link per server.
// Currently hardcoded to create-rington.com/bluemap.

import { useEffect, useState } from "react";
import { MapPinOff } from "lucide-react";

const BLUEMAP_URL = "https://create-rington.com/bluemap";

export function BlueMap() {
  const [status, setStatus] = useState<"loading" | "available" | "unavailable">(
    "loading",
  );

  useEffect(() => {
    const controller = new AbortController();

    fetch(BLUEMAP_URL, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) {
          setStatus("unavailable");
          return;
        }
        return res.text();
      })
      .then((html) => {
        if (!html) return;
        // BlueMap's HTML contains "bluemap" in script/link tags or title
        if (
          html.includes("bluemap") ||
          html.includes("BlueMap") ||
          html.includes("bluemap.js")
        ) {
          setStatus("available");
        } else {
          setStatus("unavailable");
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setStatus("unavailable");
        }
      });

    return () => controller.abort();
  }, []);

  if (status === "loading") {
    return (
      <div className="flex h-full w-full flex-1 items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading map...</div>
      </div>
    );
  }

  if (status === "unavailable") {
    return (
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
    );
  }

  return (
    <div className="flex h-full w-full flex-1">
      <iframe
        src={BLUEMAP_URL}
        title="BlueMap Viewer"
        className="h-full w-full flex-1 border-none"
      />
    </div>
  );
}
