import { lazy } from "react";

/**
 * `React.lazy` adapter for named exports. All page files in this app use
 * `export function Foo()` rather than default exports, so `React.lazy(() =>
 * import("./Foo"))` would need a `.then((m) => ({ default: m.Foo }))` tail at
 * every call site — this helper encapsulates that shape.
 *
 *     const Home = lazyNamed(() => import("./pages/Home/Home"), "Home");
 */
export function lazyNamed<
  N extends string,
  M extends Record<N, React.ComponentType<object>>,
>(loader: () => Promise<M>, name: N) {
  return lazy(() => loader().then((m) => ({ default: m[name] })));
}
