import { useEffect, useMemo, useRef, useState } from "react";
import { MapPinOff } from "lucide-react";
import { cn } from "@/lib/utils";

const BLUEMAP_URL = import.meta.env.VITE_BLUEMAP_URL as string;
const IS_SAME_ORIGIN =
  new URL(BLUEMAP_URL, window.location.href).origin === window.location.origin;

export function BlueMap() {
  const iframeSrc = useMemo(() => `${BLUEMAP_URL}${window.location.hash}`, []);
  const [mapPath] = useState(() => window.location.pathname);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const syncRef = useRef<{
    child: Window;
    handler: () => void;
    interval: ReturnType<typeof setInterval>;
  } | null>(null);
  const [mapReachable, setMapReachable] = useState<boolean | null>(
    IS_SAME_ORIGIN ? null : true,
  );
  const [frameLoaded, setFrameLoaded] = useState(false);
  const status =
    mapReachable === false
      ? "unavailable"
      : mapReachable && frameLoaded
        ? "available"
        : "loading";

  useEffect(() => {
    if (!IS_SAME_ORIGIN) return;
    const controller = new AbortController();
    fetch(`${BLUEMAP_URL}/settings.json`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`BlueMap responded ${res.status}`);
        return res.json();
      })
      .then(() => setMapReachable(true))
      .catch(() => {
        if (!controller.signal.aborted) setMapReachable(false);
      });
    return () => controller.abort();
  }, []);

  const detachSync = () => {
    if (!syncRef.current) return;
    clearInterval(syncRef.current.interval);
    try {
      syncRef.current.child.removeEventListener(
        "hashchange",
        syncRef.current.handler,
      );
    } catch {}
    syncRef.current = null;
  };

  const handleLoad = () => {
    setFrameLoaded(true);
    detachSync();
    const child = iframeRef.current?.contentWindow;
    if (!child) return;
    try {
      const sync = () => {
        if (window.location.pathname !== mapPath) {
          detachSync();
          return;
        }
        const h = child.location.hash;
        if (h && window.location.hash !== h) {
          window.history.replaceState(
            window.history.state,
            "",
            mapPath + window.location.search + h,
          );
        }
      };
      sync();
      child.addEventListener("hashchange", sync);
      const interval = setInterval(sync, 400);
      syncRef.current = { child, handler: sync, interval };
    } catch {}
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
          className={cn(
            "h-full w-full flex-1 border-none",
            status !== "available" && "invisible",
          )}
          onLoad={handleLoad}
          onError={() => setMapReachable(false)}
        />
      )}
    </div>
  );
}
