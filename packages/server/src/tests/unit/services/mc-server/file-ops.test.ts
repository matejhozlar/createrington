import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const mockConfig = vi.hoisted(() => ({
  mcServer: { localPath: null as string | null },
  envMode: { isDev: true, isDevDeployment: false },
  servers: { rails: { id: 1 } },
}));

vi.mock("@/config", () => ({ default: mockConfig }));

import {
  copyFileToServer,
  deleteFile,
  fileExists,
  writeFile,
} from "@/services/mc-server/file-ops";

const ESCAPING_NAMES = [
  "../outside.txt",
  "mods/../../outside.txt",
  "/etc/passwd",
  "C:\\outside.txt",
  "..\\outside.txt",
  "mods//a.jar",
  "./whitelist.json",
  "",
];

describe("mc-server file-ops", () => {
  let root: string;
  let dataDir: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "file-ops-"));
    dataDir = path.join(root, "data");
    await fs.mkdir(dataDir);
    mockConfig.mcServer.localPath = dataDir;
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it("writes, finds and deletes a file inside the data directory", async () => {
    await writeFile("whitelist.json", "[]");
    expect(
      await fs.readFile(path.join(dataDir, "whitelist.json"), "utf-8"),
    ).toBe("[]");
    expect(await fileExists("whitelist.json")).toBe(true);

    await deleteFile("whitelist.json");
    expect(await fileExists("whitelist.json")).toBe(false);
  });

  it("copies into a sub-directory of the data directory", async () => {
    const src = path.join(root, "pack.jar");
    await fs.writeFile(src, "jar");

    await copyFileToServer(src, "mods/pack.jar");

    expect(
      await fs.readFile(path.join(dataDir, "mods", "pack.jar"), "utf-8"),
    ).toBe("jar");
  });

  it.each(ESCAPING_NAMES)(
    "rejects %j before touching the filesystem",
    async (name) => {
      const src = path.join(root, "pack.jar");
      await fs.writeFile(src, "jar");
      await fs.writeFile(path.join(root, "outside.txt"), "keep");

      await expect(writeFile(name, "x")).rejects.toThrow(
        "escapes the data directory",
      );
      await expect(deleteFile(name)).rejects.toThrow(
        "escapes the data directory",
      );
      await expect(fileExists(name)).rejects.toThrow(
        "escapes the data directory",
      );
      await expect(copyFileToServer(src, name)).rejects.toThrow(
        "escapes the data directory",
      );

      expect(await fs.readFile(path.join(root, "outside.txt"), "utf-8")).toBe(
        "keep",
      );
    },
  );
});
