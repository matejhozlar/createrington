import { AsyncLocalStorage } from "node:async_hooks";
import { ContentGateway } from "@createrington/content-gateway-client";
import config from "@/config";

/** The pools this app's gateway token draws from: `launcher` for lookups the launcher's players trigger, `app` for everything else. */
export const ContentGatewayPool = {
  app: "app",
  launcher: "launcher",
} as const;

export type ContentGatewayPool =
  (typeof ContentGatewayPool)[keyof typeof ContentGatewayPool];

const poolContext = new AsyncLocalStorage<ContentGatewayPool>();
let gateway: ContentGateway | null = null;

/** This app's connection to the content gateway, made on first use. Throws when none is configured. */
export function contentGateway(): ContentGateway {
  if (gateway) return gateway;
  const settings = config.contentGateway;
  if (!settings) throw new Error("Content gateway not configured");
  gateway = new ContentGateway({
    baseUrl: settings.url,
    token: settings.token,
    pool: ContentGatewayPool.app,
    fetch: (input, init) => globalThis.fetch(input, init),
  });
  return gateway;
}

/** Runs `work` with every gateway call made inside it drawing from `pool` instead of the app's. */
export function inContentPool<T>(
  pool: ContentGatewayPool,
  work: () => Promise<T>,
): Promise<T> {
  return poolContext.run(pool, work);
}

/** The pool a gateway call made now draws from: the one `inContentPool` named, else the app's. */
export function currentContentPool(): ContentGatewayPool {
  return poolContext.getStore() ?? ContentGatewayPool.app;
}
