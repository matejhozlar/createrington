import { describe, it, expect, vi, beforeEach } from "vitest";

const { getChangelogMarkdownMock, getChangelogRowMock, getVersionStatusMock } =
  vi.hoisted(() => ({
    getChangelogMarkdownMock: vi.fn(),
    getChangelogRowMock: vi.fn(),
    getVersionStatusMock: vi.fn(),
  }));

vi.mock("@/services/modpack/release.service", () => ({
  modpackReleaseService: {
    getChangelogMarkdown: getChangelogMarkdownMock,
    getChangelogRow: getChangelogRowMock,
    getVersionStatus: getVersionStatusMock,
  },
}));

import { ZodError } from "zod";
import { NotFoundError } from "@/errors";
import { validate } from "@/app/middleware/validation.middleware";
import { ModpacksController } from "@/app/features/modpacks/modpacks.controller";
import {
  ChangelogRowParamsSchema,
  ProjectVersionParamsSchema,
} from "@/app/features/modpacks/modpacks.schemas";
import type { Request, Response } from "express";
import { fakeReq, fakeRes, runHandlers } from "@/tests/helpers/http";

const projectVersion = validate({ params: ProjectVersionParamsSchema });

function getChangelog(req: Request, res: Response): Promise<void> {
  return runHandlers(
    [projectVersion, ModpacksController.getChangelog],
    req,
    res,
  );
}

function getVersionStatus(req: Request, res: Response): Promise<void> {
  return runHandlers(
    [projectVersion, ModpacksController.getVersionStatus],
    req,
    res,
  );
}

function getChangelogRow(req: Request, res: Response): Promise<void> {
  return runHandlers(
    [
      validate({ params: ChangelogRowParamsSchema }),
      ModpacksController.getChangelogRow,
    ],
    req,
    res,
  );
}

function makeReq(params: Record<string, unknown>): Request {
  return fakeReq({ params });
}

const PNG = Buffer.from("png");

beforeEach(() => {
  getChangelogMarkdownMock.mockReset().mockResolvedValue("# What's new\n");
  getChangelogRowMock
    .mockReset()
    .mockResolvedValue({ png: PNG, complete: true });
  getVersionStatusMock.mockReset().mockResolvedValue({
    latest: "1.0.8",
    installed: "1.0.6",
    outdated: true,
  });
});

describe("ModpacksController.getChangelog", () => {
  it("sends the changelog as cacheable plain-text Markdown", async () => {
    const res = fakeRes();

    await getChangelog(makeReq({ project: "1660984", version: "1.0.5" }), res);

    expect(getChangelogMarkdownMock).toHaveBeenCalledWith({
      curseforgeProjectId: 1660984,
      installedVersion: "1.0.5",
    });
    expect(res.setHeader).toHaveBeenCalledWith(
      "Cache-Control",
      "public, max-age=300",
    );
    expect(res.type).toHaveBeenCalledWith("text/plain; charset=utf-8");
    expect(res.send).toHaveBeenCalledWith("# What's new\n");
  });

  it("trims the version and ignores a missing, blank or overlong one", async () => {
    for (const version of ["  1.0.5 ", undefined, "   ", "9".repeat(65)]) {
      await getChangelog(makeReq({ project: "1", version }), fakeRes());
    }

    expect(
      getChangelogMarkdownMock.mock.calls.map(([options]) => options),
    ).toEqual([
      { curseforgeProjectId: 1, installedVersion: "1.0.5" },
      { curseforgeProjectId: 1, installedVersion: undefined },
      { curseforgeProjectId: 1, installedVersion: undefined },
      { curseforgeProjectId: 1, installedVersion: undefined },
    ]);
  });

  it("rejects a malformed or out-of-range project id before loading anything", async () => {
    for (const project of [
      undefined,
      "",
      "0",
      "-5",
      "12ab",
      "01",
      "2147483648",
    ]) {
      await expect(
        getChangelog(makeReq({ project }), fakeRes()),
      ).rejects.toBeInstanceOf(ZodError);
    }
    expect(getChangelogMarkdownMock).not.toHaveBeenCalled();
  });

  it("lets a missing pack or release surface as 404", async () => {
    getChangelogMarkdownMock.mockRejectedValue(new NotFoundError("nope"));

    await expect(
      getChangelog(makeReq({ project: "42" }), fakeRes()),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("ModpacksController.getChangelogRow", () => {
  it("sends the row as a PNG cacheable for a day", async () => {
    const res = fakeRes();

    await getChangelogRow(
      makeReq({ project: "1660984", release: "8840313", mod: "328085" }),
      res,
    );

    expect(getChangelogRowMock).toHaveBeenCalledWith({
      curseforgeProjectId: 1660984,
      releaseFileId: 8840313,
      entryProjectId: 328085,
    });
    expect(res.setHeader).toHaveBeenCalledWith(
      "Cache-Control",
      "public, max-age=86400",
    );
    expect(res.type).toHaveBeenCalledWith("image/png");
    expect(res.send).toHaveBeenCalledWith(PNG);
  });

  it("caches a row drawn with a placeholder icon for a minute only", async () => {
    getChangelogRowMock.mockResolvedValue({ png: PNG, complete: false });
    const res = fakeRes();

    await getChangelogRow(
      makeReq({ project: "1", release: "2", mod: "3" }),
      res,
    );

    expect(res.setHeader).toHaveBeenCalledWith(
      "Cache-Control",
      "public, max-age=60",
    );
  });

  it("rejects malformed ids before loading anything", async () => {
    for (const params of [
      { project: "x", release: "2", mod: "3" },
      { project: "1", release: "0", mod: "3" },
      { project: "1", release: "2", mod: "3.5" },
    ]) {
      await expect(
        getChangelogRow(makeReq(params), fakeRes()),
      ).rejects.toBeInstanceOf(ZodError);
    }
    expect(getChangelogRowMock).not.toHaveBeenCalled();
  });
});

describe("ModpacksController.getVersionStatus", () => {
  it("sends the status as cacheable JSON", async () => {
    const res = fakeRes();

    await getVersionStatus(
      makeReq({ project: "1660984", version: "1.0.6" }),
      res,
    );

    expect(getVersionStatusMock).toHaveBeenCalledWith({
      curseforgeProjectId: 1660984,
      installedVersion: "1.0.6",
    });
    expect(res.setHeader).toHaveBeenCalledWith(
      "Cache-Control",
      "public, max-age=300",
    );
    expect(res.json).toHaveBeenCalledWith({
      latest: "1.0.8",
      installed: "1.0.6",
      outdated: true,
    });
  });

  it("trims the version and ignores a whitespace-only or overlong one", async () => {
    for (const version of ["  1.0.6 ", "   ", "9".repeat(65)]) {
      await getVersionStatus(makeReq({ project: "1", version }), fakeRes());
    }

    expect(getVersionStatusMock.mock.calls.map(([options]) => options)).toEqual(
      [
        { curseforgeProjectId: 1, installedVersion: "1.0.6" },
        { curseforgeProjectId: 1, installedVersion: undefined },
        { curseforgeProjectId: 1, installedVersion: undefined },
      ],
    );
  });

  it("rejects a malformed project id before loading anything", async () => {
    for (const project of [undefined, "", "0", "12ab", "2147483648"]) {
      await expect(
        getVersionStatus(makeReq({ project, version: "1.0.6" }), fakeRes()),
      ).rejects.toBeInstanceOf(ZodError);
    }
    expect(getVersionStatusMock).not.toHaveBeenCalled();
  });

  it("lets a missing pack or release surface as 404", async () => {
    getVersionStatusMock.mockRejectedValue(new NotFoundError("nope"));

    await expect(
      getVersionStatus(makeReq({ project: "42", version: "1.0.6" }), fakeRes()),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
