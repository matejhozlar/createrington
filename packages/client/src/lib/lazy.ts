import { lazy } from "react";

export function lazyNamed<
  N extends string,
  M extends Record<N, React.ComponentType<object>>,
>(loader: () => Promise<M>, name: N) {
  return lazy(() => loader().then((m) => ({ default: m[name] })));
}
