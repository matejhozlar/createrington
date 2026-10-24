import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import type { Request, Response } from "express";
import type {
  LauncherPackData,
  LauncherPackFilesData,
  LauncherPackReleasesData,
  LauncherPacksData,
  LauncherSuccessResponse,
} from "@createrington/shared/launcher";
import { getValidated } from "@/app/middleware/validation.middleware";
import { sendCachedJson } from "@/app/utils/cached-json";
import { createKeyValueStore } from "@/services/key-value-store";
import {
  launcherPackService,
  type StorageDownload,
} from "@/services/launcher/pack/launcher-pack.service";
import { buildPagination } from "@/trpc/utils";
import type {
  ListReleasesQuery,
  PackParams,
  ResolveFilesBody,
  StorageFileParams,
  StorageSnapshotParams,
} from "./launcher-pack.schemas";

const KEY_PREFIX = "launcher:packs";
const ANSWER_TTL_MS = 60_000;
const MAX_MEMORY_ANSWERS = 500;

const answerCache = createKeyValueStore(MAX_MEMORY_ANSWERS);

function exactLength(size: number): Transform {
  let seen = 0;
  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      seen += chunk.length;
      if (seen > size) {
        callback(new Error(`more than the announced ${size} bytes arrived`));
        return;
      }
      callback(null, chunk);
    },
    flush(callback) {
      callback(
        seen === size
          ? null
          : new Error(`${seen} of the announced ${size} bytes arrived`),
      );
    },
  });
}

async function streamStorage(
  req: Request,
  res: Response,
  open: (signal: AbortSignal) => Promise<StorageDownload>,
): Promise<void> {
  const client = new AbortController();
  res.on("close", () => {
    if (!res.writableFinished) client.abort();
  });

  let download: StorageDownload;
  try {
    download = await open(client.signal);
  } catch (error) {
    if (client.signal.aborted) return;
    throw error;
  }
  res.status(200);
  res.attachment(download.fileName);
  res.setHeader("Content-Length", String(download.size));
  res.setHeader("Cache-Control", "private, no-store");

  try {
    await pipeline(
      Readable.fromWeb(download.body as NodeReadableStream<Uint8Array>),
      exactLength(download.size),
      res,
    );
  } catch (error) {
    if (!res.headersSent) throw error;
    logger.debug(
      `Storage download ${req.originalUrl} ended early: ${error instanceof Error ? error.message : String(error)}`,
    );
    res.destroy();
  }
}

export class LauncherPackController {
  static async list(req: Request, res: Response): Promise<void> {
    await sendCachedJson(
      req,
      res,
      answerCache,
      `${KEY_PREFIX}:list`,
      ANSWER_TTL_MS,
      async (): Promise<LauncherSuccessResponse<LauncherPacksData>> => ({
        success: true,
        data: { packs: await launcherPackService.listPacks() },
      }),
    );
  }

  static async latest(req: Request, res: Response): Promise<void> {
    const { params } = getValidated<{ params: PackParams }>(res);
    await sendCachedJson(
      req,
      res,
      answerCache,
      `${KEY_PREFIX}:latest:${params.slug}`,
      ANSWER_TTL_MS,
      async (): Promise<LauncherSuccessResponse<LauncherPackData>> => ({
        success: true,
        data: await launcherPackService.getLatestPack(params.slug),
      }),
    );
  }

  static async releases(req: Request, res: Response): Promise<void> {
    const { params, query } = getValidated<{
      params: PackParams;
      query: ListReleasesQuery;
    }>(res);
    await sendCachedJson(
      req,
      res,
      answerCache,
      `${KEY_PREFIX}:releases:${params.slug}:${query.page}:${query.limit}`,
      ANSWER_TTL_MS,
      async (): Promise<LauncherSuccessResponse<LauncherPackReleasesData>> => {
        const { releases, total } = await launcherPackService.listReleases(
          params.slug,
          query,
        );
        return {
          success: true,
          data: {
            releases,
            pagination: buildPagination(query.page, query.limit, total),
          },
        };
      },
    );
  }

  static async resolveFiles(_req: Request, res: Response): Promise<void> {
    const { body } = getValidated<{ body: ResolveFilesBody }>(res);

    const response: LauncherSuccessResponse<LauncherPackFilesData> = {
      success: true,
      data: await launcherPackService.resolveFiles(body.fileIds),
    };
    res.json(response);
  }

  static async storageFile(req: Request, res: Response): Promise<void> {
    const { params } = getValidated<{ params: StorageFileParams }>(res);
    await streamStorage(req, res, (signal) =>
      launcherPackService.openStorageFile(params.fileId, signal),
    );
  }

  static async storageSnapshot(req: Request, res: Response): Promise<void> {
    const { params } = getValidated<{ params: StorageSnapshotParams }>(res);
    await streamStorage(req, res, (signal) =>
      launcherPackService.openStorageSnapshot(params.id, signal),
    );
  }
}
