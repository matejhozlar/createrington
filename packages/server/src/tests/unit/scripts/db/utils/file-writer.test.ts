import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  ensureDirectory,
  writeFile,
  writeFileIfNotExists,
  copyFile,
  getRelativePath,
  cleanDirectory,
} from "@/scripts/db/utils/file-writer";

describe("file-writer", () => {
  let tmpRoot: string;

  beforeEach(async () => {
    tmpRoot = await fsp.mkdtemp(
      path.join(os.tmpdir(), "createrington-fw-test-"),
    );
  });

  afterEach(async () => {
    await fsp.rm(tmpRoot, { recursive: true, force: true });
  });

  describe("ensureDirectory", () => {
    it("creates a missing directory recursively", () => {
      const target = path.join(tmpRoot, "a", "b", "c");
      ensureDirectory(target);
      expect(fs.existsSync(target)).toBe(true);
      expect(fs.statSync(target).isDirectory()).toBe(true);
    });

    it("is a no-op when the directory already exists", () => {
      const target = path.join(tmpRoot, "exists");
      fs.mkdirSync(target);
      expect(() => ensureDirectory(target)).not.toThrow();
      expect(fs.existsSync(target)).toBe(true);
    });
  });

  describe("writeFile", () => {
    it("creates parent directories and writes UTF-8 content", () => {
      const target = path.join(tmpRoot, "nested", "out.txt");
      writeFile(target, "héllo");
      expect(fs.readFileSync(target, "utf-8")).toBe("héllo");
    });

    it("overwrites existing files", () => {
      const target = path.join(tmpRoot, "out.txt");
      writeFile(target, "first");
      writeFile(target, "second");
      expect(fs.readFileSync(target, "utf-8")).toBe("second");
    });
  });

  describe("writeFileIfNotExists", () => {
    it("creates the file and returns true when it doesn't exist", () => {
      const target = path.join(tmpRoot, "scaffold.ts");
      expect(writeFileIfNotExists(target, "// scaffold")).toBe(true);
      expect(fs.readFileSync(target, "utf-8")).toBe("// scaffold");
    });

    it("does not overwrite an existing file and returns false", () => {
      const target = path.join(tmpRoot, "scaffold.ts");
      writeFile(target, "user changes");
      expect(writeFileIfNotExists(target, "// scaffold")).toBe(false);
      expect(fs.readFileSync(target, "utf-8")).toBe("user changes");
    });
  });

  describe("copyFile", () => {
    it("copies a file and creates the destination directory", () => {
      const src = path.join(tmpRoot, "src.txt");
      const dst = path.join(tmpRoot, "nested", "dst.txt");
      writeFile(src, "payload");

      copyFile(src, dst);

      expect(fs.readFileSync(dst, "utf-8")).toBe("payload");
    });

    it("overwrites the destination if it already exists", () => {
      const src = path.join(tmpRoot, "src.txt");
      const dst = path.join(tmpRoot, "dst.txt");
      writeFile(src, "new");
      writeFile(dst, "old");

      copyFile(src, dst);

      expect(fs.readFileSync(dst, "utf-8")).toBe("new");
    });

    it("throws when the source doesn't exist", () => {
      expect(() =>
        copyFile(path.join(tmpRoot, "missing"), path.join(tmpRoot, "dst")),
      ).toThrow();
    });
  });

  describe("getRelativePath", () => {
    it("returns the relative path between two locations", () => {
      const from = path.join(tmpRoot, "queries");
      const to = path.join(tmpRoot, "types", "User.ts");
      const rel = getRelativePath(from, to);
      // Use path.join to stay platform-agnostic
      expect(rel).toBe(path.join("..", "types", "User.ts"));
    });

    it("returns '' when from === to", () => {
      const same = path.join(tmpRoot, "same");
      expect(getRelativePath(same, same)).toBe("");
    });
  });

  describe("cleanDirectory", () => {
    it("creates the directory if it doesn't exist", async () => {
      const target = path.join(tmpRoot, "fresh");
      await cleanDirectory(target);
      expect(fs.existsSync(target)).toBe(true);
      expect(fs.readdirSync(target)).toEqual([]);
    });

    it("wipes existing contents and recreates the directory empty", async () => {
      const target = path.join(tmpRoot, "dirty");
      fs.mkdirSync(target);
      writeFile(path.join(target, "stale.txt"), "stale");

      await cleanDirectory(target);

      expect(fs.existsSync(target)).toBe(true);
      expect(fs.readdirSync(target)).toEqual([]);
    });
  });
});
