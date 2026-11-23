import { lazy } from "react";

type LazyComponent = Parameters<typeof lazy>[0] extends () => Promise<{
  default: infer T;
}>
  ? T
  : never;

export function lazyNamed<N extends string, M extends Record<N, LazyComponent>>(
  loader: () => Promise<M>,
  name: N,
) {
  return lazy(() => loader().then((m) => ({ default: m[name] })));
}
