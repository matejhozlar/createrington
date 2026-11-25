import { lazy } from "react";

type LazyComponent = Parameters<typeof lazy>[0] extends () => Promise<{
  default: infer T;
}>
  ? T
  : never;

const RELOADED_AT_KEY = "chunk_reloaded_at";
const RELOAD_GUARD_MS = 10_000;

async function reloadOnce(error: unknown): Promise<never> {
  const last = Number(sessionStorage.getItem(RELOADED_AT_KEY) ?? 0);
  if (Date.now() - last < RELOAD_GUARD_MS) throw error;
  sessionStorage.setItem(RELOADED_AT_KEY, String(Date.now()));
  window.location.reload();
  return new Promise<never>(() => {});
}

export function lazyNamed<N extends string, M extends Record<N, LazyComponent>>(
  loader: () => Promise<M>,
  name: N,
) {
  return lazy(() => loader().then((m) => ({ default: m[name] }), reloadOnce));
}
