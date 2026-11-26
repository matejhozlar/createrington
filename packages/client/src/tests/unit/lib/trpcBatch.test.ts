import { describe, expect, it } from "vitest";
import { isUnauthorizedBatch } from "@/lib/trpcBatch";

const unauthorizedItem = {
  error: {
    message: "Unauthorized",
    code: -32001,
    data: { code: "UNAUTHORIZED", httpStatus: 401 },
  },
};
const okItem = { result: { data: { ok: true } } };

function batchResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("isUnauthorizedBatch", () => {
  it("treats a plain 401 as unauthorized", async () => {
    await expect(
      isUnauthorizedBatch(batchResponse(401, [unauthorizedItem]), "GET"),
    ).resolves.toBe(true);
  });

  it("finds an unauthorized item inside a mixed query batch", async () => {
    await expect(
      isUnauthorizedBatch(
        batchResponse(207, [okItem, unauthorizedItem]),
        undefined,
      ),
    ).resolves.toBe(true);
  });

  it("ignores a mixed batch whose errors are not 401", async () => {
    const notFound = {
      error: { data: { code: "NOT_FOUND", httpStatus: 404 } },
    };
    await expect(
      isUnauthorizedBatch(batchResponse(207, [okItem, notFound]), "GET"),
    ).resolves.toBe(false);
  });

  it("does not retry a mixed mutation batch, whose other items already ran", async () => {
    await expect(
      isUnauthorizedBatch(
        batchResponse(207, [okItem, unauthorizedItem]),
        "POST",
      ),
    ).resolves.toBe(false);
  });

  it("leaves the body readable for tRPC", async () => {
    const response = batchResponse(207, [okItem, unauthorizedItem]);
    await isUnauthorizedBatch(response, "GET");
    await expect(response.json()).resolves.toEqual([okItem, unauthorizedItem]);
  });
});
