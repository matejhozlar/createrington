import { describe, it, expect, vi, beforeEach } from "vitest";

const { isFileOpsAllowed, writeFile, deleteFile, getWhitelistEntries, rcon } =
  vi.hoisted(() => ({
    isFileOpsAllowed: vi.fn(),
    writeFile: vi.fn(),
    deleteFile: vi.fn(),
    getWhitelistEntries: vi.fn(),
    rcon: { whitelist: vi.fn() },
  }));

vi.mock("@/services/mc-server/file-ops", () => ({
  isFileOpsAllowed,
  writeFile,
  deleteFile,
}));
vi.mock("@/db", () => ({ Q: { player: { getWhitelistEntries } } }));
vi.mock("@/utils/rcon", () => ({
  MinecraftRconManager: { getInstance: () => rcon },
  WhitelistAction: { RELOAD: "reload" },
}));

import { WhitelistService } from "@/services/whitelist";

const SERVER_ID = 1;
const ENTRIES = [
  { uuid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "Steve" },
  { uuid: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", name: "Alex" },
];

const service = new WhitelistService();

beforeEach(() => {
  vi.clearAllMocks();
  isFileOpsAllowed.mockReturnValue(true);
  writeFile.mockResolvedValue(undefined);
  getWhitelistEntries.mockResolvedValue(ENTRIES);
  rcon.whitelist.mockResolvedValue({ success: true });
});

describe("WhitelistService.resync", () => {
  it("overwrites whitelist.json with the registered players, then reloads it", async () => {
    await expect(service.resync(SERVER_ID)).resolves.toEqual({ count: 2 });

    expect(writeFile).toHaveBeenCalledWith(
      "whitelist.json",
      JSON.stringify(ENTRIES, null, 2),
    );
    expect(rcon.whitelist).toHaveBeenCalledWith(SERVER_ID, "reload");
    expect(writeFile.mock.invocationCallOrder[0]).toBeLessThan(
      rcon.whitelist.mock.invocationCallOrder[0],
    );
  });

  it("never deletes the existing file", async () => {
    await service.resync(SERVER_ID);

    expect(deleteFile).not.toHaveBeenCalled();
  });

  it("leaves the existing file alone and skips the reload when the write fails", async () => {
    writeFile.mockRejectedValue(new Error("SFTP connection reset"));

    await expect(service.resync(SERVER_ID)).rejects.toThrow(
      "SFTP connection reset",
    );

    expect(deleteFile).not.toHaveBeenCalled();
    expect(rcon.whitelist).not.toHaveBeenCalled();
  });

  it("refuses without touching anything when file access is not configured", async () => {
    isFileOpsAllowed.mockReturnValue(false);

    await expect(service.resync(SERVER_ID)).rejects.toThrow(
      "Whitelist resync is not available",
    );

    expect(getWhitelistEntries).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
    expect(rcon.whitelist).not.toHaveBeenCalled();
  });
});
