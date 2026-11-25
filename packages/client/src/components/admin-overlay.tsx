import { useEffect } from "react";
import { useLocation, useParams, type Params } from "react-router";
import { queryClient, trpc, type RouterOutput } from "@/lib/trpc";
import { useAdminOverlay } from "@/hooks/use-admin-overlay";

type Overlay = NonNullable<RouterOutput["admin"]["overlay"]["get"]>;

interface OverlayGlobal {
  init: (options: {
    project: string;
    token: () => Promise<string>;
    apiUrl: string;
    commitSha?: string;
    routePattern: () => string | null;
  }) => void;
}

const COMMIT_SHA: string | undefined = import.meta.env.VITE_COMMIT_SHA;
const TOKEN_STALE_MS = 5 * 60 * 1000;

let currentRoutePattern: string | null = null;
let isScriptRequested = false;

async function fetchToken(): Promise<string> {
  const token = await queryClient.fetchQuery({
    ...trpc.admin.overlay.token.get.queryOptions(),
    staleTime: TOKEN_STALE_MS,
  });
  if (!token) throw new Error("Unavailable");
  return token;
}

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function toRoutePattern(pathname: string, params: Readonly<Params>): string {
  const segments = pathname.split("/");
  const splat = params["*"];
  const splatLength = splat ? splat.split("/").length : 0;
  const fixed = splatLength ? segments.slice(0, -splatLength) : segments;
  const unmatched = new Map(
    Object.entries(params).filter(([name]) => name !== "*"),
  );

  const pattern = [...fixed];
  for (let index = pattern.length - 1; index >= 0; index -= 1) {
    const value = decodeSegment(pattern[index] ?? "");
    const name = [...unmatched].find(([, param]) => param === value)?.[0];
    if (!name) continue;
    unmatched.delete(name);
    pattern[index] = `:${name}`;
  }

  return splatLength ? [...pattern, "*"].join("/") : pattern.join("/");
}

function loadOverlay(overlay: Overlay) {
  if (isScriptRequested) return;
  isScriptRequested = true;

  const script = document.createElement("script");
  script.src = overlay.scriptUrl;
  script.async = true;
  script.onload = () => {
    const global = (window as unknown as Record<string, unknown>)[
      overlay.globalName
    ] as OverlayGlobal | undefined;
    global?.init({
      project: overlay.project,
      token: fetchToken,
      apiUrl: overlay.apiUrl,
      commitSha: COMMIT_SHA,
      routePattern: () => currentRoutePattern,
    });
  };
  script.onerror = () => {
    isScriptRequested = false;
    script.remove();
  };
  document.head.append(script);
}

export function AdminOverlay() {
  const { isAdmin, overlay } = useAdminOverlay();
  const { pathname } = useLocation();
  const params = useParams();

  useEffect(() => {
    currentRoutePattern = toRoutePattern(pathname, params);
  }, [pathname, params]);

  useEffect(() => {
    if (!isAdmin) {
      if (isScriptRequested) {
        window.location.reload();
        return;
      }
      queryClient.removeQueries(trpc.admin.overlay.pathFilter());
      return;
    }
    if (overlay) loadOverlay(overlay);
  }, [isAdmin, overlay]);

  return null;
}
