import { createHash } from "node:crypto";
import type { Request, Response } from "express";
import { type KeyValueStore, readThrough } from "@/services/key-value-store";

interface StoredAnswer {
  etag: string;
  body: string;
}

function strongEtag(body: string): string {
  return `"${createHash("sha1").update(body).digest("base64url")}"`;
}

export async function sendCachedJson(
  req: Request,
  res: Response,
  store: KeyValueStore,
  key: string,
  ttlMs: number,
  load: () => Promise<unknown>,
): Promise<void> {
  const answer = await readThrough<StoredAnswer>(
    store,
    key,
    ttlMs,
    async () => {
      const body = JSON.stringify(await load());
      return { etag: strongEtag(body), body };
    },
  );

  res.setHeader("ETag", answer.etag);
  res.setHeader(
    "Cache-Control",
    `private, max-age=${Math.floor(ttlMs / 1000)}`,
  );
  if (req.fresh) {
    res.status(304).end();
    return;
  }
  res.type("application/json").send(answer.body);
}
