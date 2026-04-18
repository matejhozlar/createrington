import { dts } from "rollup-plugin-dts";
import nodeResolve from "@rollup/plugin-node-resolve";

/**
 * Bundles all transitively-referenced types into one self-contained .d.ts.
 *
 * - `nodeResolve` lets rollup find @createrington/server via workspace linking
 *   and the package.json `exports` field.
 * - `dts({ respectExternal: true })` inlines the referenced types rather than
 *   re-exporting them as external modules.
 * - `@trpc/server` is kept external; consumers bring it via peerDependencies.
 */
export default {
  input: "./src/index.ts",
  output: [{ file: "./dist/index.d.ts", format: "es" }],
  plugins: [
    nodeResolve({
      extensions: [".ts", ".d.ts"],
      exportConditions: ["types", "import", "default"],
    }),
    dts({
      respectExternal: true,
    }),
  ],
  external: [/^@trpc\/server/],
};
