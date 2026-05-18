// TODO: Refactor to dynamically open the map for a configured server.
// TODO: Add backend routes to provide the map link per server.

import { useEffect, useMemo, useRef, useState } from "react";
import { MapPinOff } from "lucide-react";

const BLUEMAP_URL = import.meta.env.VITE_BLUEMAP_URL as string;

export function BlueMap() {
  // Computed once so our own replaceState below doesn't reload the iframe.
  const iframeSrc = useMemo(() => `${BLUEMAP_URL}${window.location.hash}`, []);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const syncRef = useRef<{
    child: Window;
    handler: () => void;
    interval: ReturnType<typeof setInterval>;
  } | null>(null);
  const [status, setStatus] = useState<"loading" | "available" | "unavailable">(
    "loading",
  );

  const detachSync = () => {
    if (!syncRef.current) return;
    clearInterval(syncRef.current.interval);
    try {
      syncRef.current.child.removeEventListener(
        "hashchange",
        syncRef.current.handler,
      );
    } catch {
      // child window already torn down
    }
    syncRef.current = null;
  };

  const handleLoad = () => {
    setStatus("available");
    detachSync();
    const child = iframeRef.current?.contentWindow;
    if (!child) return;
    try {
      const sync = () => {
        const h = child.location.hash;
        if (h && window.location.hash !== h) {
          window.history.replaceState(
            null,
            "",
            window.location.pathname + window.location.search + h,
          );
        }
      };
      sync();
      child.addEventListener("hashchange", sync);
      // BlueMap updates its hash via history.replaceState, which doesn't fire
      // hashchange; poll as the actual sync mechanism, keep the listener as
      // a no-cost fallback for any future BlueMap that does fire it.
      const interval = setInterval(sync, 400);
      syncRef.current = { child, handler: sync, interval };
    } catch {
      // cross-origin BLUEMAP_URL (dev pointing at prod); sync degrades
    }
  };

  useEffect(() => detachSync, []);

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
          ref={iframeRef}
          src={iframeSrc}
          title="BlueMap Viewer"
          className="h-full w-full flex-1 border-none"
          onLoad={handleLoad}
          onError={() => setStatus("unavailable")}
        />
      )}
    </div>
  );
}
