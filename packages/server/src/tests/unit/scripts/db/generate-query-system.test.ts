import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generate } from "@/scripts/db/generate-query-system";
import type { GenerationResult } from "@/scripts/db/types";
import * as fixtureSchema from "./fixtures/schema";

const SNAPSHOT_DIR = fileURLToPath(
  new URL("./__snapshots__/", import.meta.url),
);

const schema = Object.fromEntries(
  Object.entries(fixtureSchema).sort(([a], [b]) => (a < b ? -1 : 1)),
);

const SHARED_FILES = [
  "shared/base.types.ts",
  "shared/database.types.ts",
  "shared/fixture_audit_entry.types.ts",
  "shared/fixture_parent.types.ts",
  "shared/fixture_parent_child.types.ts",
  "shared/fixture_parent_child_leaf.types.ts",
  "shared/fixture_setting.types.ts",
  "shared/index.ts",
];

const GENERATED_FILES = [
  "generated/constants.ts",
  "generated/db.ts",
  "generated/fixture.queries.ts",
  "generated/fixture_audit.queries.ts",
  "generated/fixture_audit_entry.queries.ts",
  "generated/fixture_parent.queries.ts",
  "generated/fixture_parent_child.queries.ts",
  "generated/fixture_parent_child_leaf.queries.ts",
  "generated/fixture_setting.queries.ts",
  "generated/index.ts",
  "generated/queries.ts",
];

const SCAFFOLDED_FILES = [
  "queries/fixture/audit/entry/index.ts",
  "queries/fixture/parent/child/index.ts",
  "queries/fixture/parent/child/leaf/index.ts",
  "queries/fixture/parent/index.ts",
  "queries/fixture/setting/index.ts",
];

const NAMESPACE_COPIES = [
  "queries/fixture/audit/index.ts",
  "queries/fixture/index.ts",
];

const ALL_FILES = [
  ...SHARED_FILES,
  ...GENERATED_FILES,
  ...SCAFFOLDED_FILES,
  ...NAMESPACE_COPIES,
  "queries/index.ts",
].sort();

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

describe("db query-system generator", () => {
  let tmpRoot: string;
  let result: GenerationResult;

  beforeAll(async () => {
    tmpRoot = await fsp.mkdtemp(
      path.join(os.tmpdir(), "createrington-generator-"),
    );
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      result = await generate({
        schema,
        context: {
          projectRoot: tmpRoot,
          sharedTypesDir: path.join(tmpRoot, "shared"),
          generatedDir: path.join(tmpRoot, "generated"),
          actualQueriesDir: path.join(tmpRoot, "queries"),
        },
      });
    } finally {
      log.mockRestore();
    }
  });

  afterAll(async () => {
    await fsp.rm(tmpRoot, { recursive: true, force: true });
  });

  it("reads every fixture table", () => {
    expect(result.tablesFound).toBe(5);
  });

  it("reports generated files relative to the project root", () => {
    expect(result.files.map(toPosix).sort()).toEqual(
      [...SHARED_FILES, ...GENERATED_FILES, "queries/index.ts"].sort(),
    );
  });

  it("scaffolds one user query file per table", () => {
    expect(result.scaffolds.map(toPosix).sort()).toEqual(SCAFFOLDED_FILES);
  });

  it("writes exactly the snapshotted files", () => {
    expect(listFiles(tmpRoot)).toEqual(ALL_FILES);
  });

  it.each(ALL_FILES)("emits %s", async (file) => {
    const content = fs.readFileSync(path.join(tmpRoot, file), "utf-8");
    await expect(content).toMatchFileSnapshot(
      path.join(SNAPSHOT_DIR, `${file}.snap`),
    );
  });
});
