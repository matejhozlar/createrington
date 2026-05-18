// TODO: Refactor to dynamically open the map for a configured server.
// TODO: Add backend routes to provide the map link per server.

import { useMemo, useRef, useState } from "react";
import { MapPinOff } from "lucide-react";

const BLUEMAP_URL = import.meta.env.VITE_BLUEMAP_URL as string;

export function BlueMap() {
  // Compute iframe src once so re-renders triggered by our own
  // history.replaceState below don't reload the iframe and reset the view.
  const iframeSrc = useMemo(() => `${BLUEMAP_URL}${window.location.hash}`, []);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [status, setStatus] = useState<"loading" | "available" | "unavailable">(
    "loading",
  );

  // BlueMap writes its position into its own URL hash. Mirror that hash into
  // the parent window so users can copy/share the URL bar, matching BlueMap's
  // native UX when it isn't iframed. Requires same-origin with BLUEMAP_URL;
  // in dev (when VITE_BLUEMAP_URL points to prod) this silently no-ops.
  const handleLoad = () => {
    setStatus("available");
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
    } catch {
      // Cross-origin BLUEMAP_URL (typically dev pointing at prod). Sharing
      // via URL bar won't work in this env, but the map still loads.
    }
  };

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
