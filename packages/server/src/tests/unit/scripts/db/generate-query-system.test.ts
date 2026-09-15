import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generate } from "@/scripts/db/generate-query-system";
import type { GenerationContext, GenerationResult } from "@/scripts/db/types";
import * as fixtureSchema from "./fixtures/schema";

const SNAPSHOT_DIR = fileURLToPath(
  new URL("./__snapshots__/", import.meta.url),
);

function byEsmNamespaceKeyOrder(
  [a]: [string, unknown],
  [b]: [string, unknown],
): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

const schema = Object.fromEntries(
  Object.entries(fixtureSchema).sort(byEsmNamespaceKeyOrder),
);

const SHARED_FILES = [
  "shared-db/base.types.ts",
  "shared-db/database.types.ts",
  "shared-db/fixture_audit_entry.types.ts",
  "shared-db/fixture_parent.types.ts",
  "shared-db/fixture_parent_child.types.ts",
  "shared-db/fixture_parent_child_leaf.types.ts",
  "shared-db/fixture_setting.types.ts",
  "shared-db/index.ts",
];

const GENERATED_FILES = [
  "generated-db/constants.ts",
  "generated-db/db.ts",
  "generated-db/fixture.queries.ts",
  "generated-db/fixture_audit.queries.ts",
  "generated-db/fixture_audit_entry.queries.ts",
  "generated-db/fixture_parent.queries.ts",
  "generated-db/fixture_parent_child.queries.ts",
  "generated-db/fixture_parent_child_leaf.queries.ts",
  "generated-db/fixture_setting.queries.ts",
  "generated-db/index.ts",
  "generated-db/queries.ts",
];

const SCAFFOLDED_FILES = [
  "db-queries/fixture/audit/entry/index.ts",
  "db-queries/fixture/parent/child/index.ts",
  "db-queries/fixture/parent/child/leaf/index.ts",
  "db-queries/fixture/parent/index.ts",
  "db-queries/fixture/setting/index.ts",
];

const NAMESPACE_COPIES = [
  "db-queries/fixture/audit/index.ts",
  "db-queries/fixture/index.ts",
];

const REGENERATED_FILES = [
  ...SHARED_FILES,
  ...GENERATED_FILES,
  "db-queries/index.ts",
].sort();

const ALL_FILES = [
  ...REGENERATED_FILES,
  ...SCAFFOLDED_FILES,
  ...NAMESPACE_COPIES,
].sort();

const NAMESPACE_MARKER = "This is a pure organizational namespace";
const HAND_WRITTEN = "export const handWritten = true;\n";

function toPosix(relativePath: string): string {
  return relativePath.split(path.sep).join("/");
}

function listFiles(root: string, dir = root): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = entries.flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory()
      ? listFiles(root, full)
      : [toPosix(path.relative(root, full))];
  });
  return files.sort();
}

function outputContext(root: string): GenerationContext {
  return {
    projectRoot: root,
    monorepoRoot: root,
    sharedPackageRoot: root,
    sharedTypesDir: path.join(root, "shared-db"),
    generatedDir: path.join(root, "generated-db"),
    actualQueriesDir: path.join(root, "db-queries"),
  };
}

async function runGenerator(root: string): Promise<GenerationResult> {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  try {
    return await generate({ schema, context: outputContext(root) });
  } finally {
    log.mockRestore();
  }
}

describe("db query-system generator", () => {
  let tmpRoot: string;
  let result: GenerationResult;

  const read = (file: string) =>
    fs.readFileSync(path.join(tmpRoot, file), "utf-8");

  beforeAll(async () => {
    tmpRoot = await fsp.mkdtemp(
      path.join(os.tmpdir(), "createrington-generator-"),
    );
    result = await runGenerator(tmpRoot);
  });

  afterAll(async () => {
    await fsp.rm(tmpRoot, { recursive: true, force: true });
  });

  it("reads every fixture table", () => {
    expect(result.tablesFound).toBe(5);
  });

  it("reports generated files relative to the project root", () => {
    expect(result.files.map(toPosix).sort()).toEqual(REGENERATED_FILES);
  });

  it("scaffolds one user query file per table", () => {
    expect(result.scaffolds.map(toPosix).sort()).toEqual(SCAFFOLDED_FILES);
  });

  it("writes exactly the snapshotted files", () => {
    expect(listFiles(tmpRoot)).toEqual(ALL_FILES);
  });

  it.each(ALL_FILES)("emits %s", async (file) => {
    await expect(read(file)).toMatchFileSnapshot(
      path.join(SNAPSHOT_DIR, `${file}.snap`),
    );
  });

  describe("second run over the same output directories", () => {
    const scaffold = "db-queries/fixture/parent/index.ts";
    const namespaceCopy = "db-queries/fixture/index.ts";
    const userFileAtNamespacePath = "db-queries/fixture/audit/index.ts";

    let firstRun: Map<string, string>;
    let secondResult: GenerationResult;

    beforeAll(async () => {
      firstRun = new Map(ALL_FILES.map((file) => [file, read(file)]));
      fs.writeFileSync(path.join(tmpRoot, scaffold), HAND_WRITTEN);
      fs.appendFileSync(
        path.join(tmpRoot, namespaceCopy),
        "export const stale = true;\n",
      );
      fs.writeFileSync(
        path.join(tmpRoot, userFileAtNamespacePath),
        HAND_WRITTEN,
      );
      secondResult = await runGenerator(tmpRoot);
    });

    it("never scaffolds over an existing user query file", () => {
      expect(secondResult.scaffolds).toEqual([]);
      expect(read(scaffold)).toBe(HAND_WRITTEN);
    });

    it("refreshes a namespace copy that is still a generated file", () => {
      expect(firstRun.get(namespaceCopy)).toContain(NAMESPACE_MARKER);
      expect(read(namespaceCopy)).toBe(read("generated-db/fixture.queries.ts"));
    });

    it("keeps a user file that sits at a namespace path", () => {
      expect(read(userFileAtNamespacePath)).toBe(HAND_WRITTEN);
    });

    it("regenerates the shared and generated files byte for byte", () => {
      expect(secondResult.files.map(toPosix).sort()).toEqual(
        result.files.map(toPosix).sort(),
      );
      expect(listFiles(tmpRoot)).toEqual(ALL_FILES);
      for (const file of REGENERATED_FILES) {
        expect(read(file)).toBe(firstRun.get(file));
      }
    });
  });
});
