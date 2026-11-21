import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  describeHttpError,
  downloadCapped,
  DownloadTooLargeError,
  fetchJson,
  HttpStatusError,
  readBody,
  withQuery,
} from "@/utils/http";

describe("withQuery", () => {
  it("appends the parameters to the url", () => {
    expect(
      withQuery("http://upstream.test/api/chat", { repo: "a/b", limit: 5 }),
    ).toBe("http://upstream.test/api/chat?repo=a%2Fb&limit=5");
  });

  it("skips undefined and null values", () => {
    expect(
      withQuery("http://upstream.test/api", {
        cursor: undefined,
        after: null,
        keep: "yes",
      }),
    ).toBe("http://upstream.test/api?keep=yes");
  });

  it("repeats the key for an array", () => {
    expect(withQuery("http://upstream.test/api", { id: ["1", "2"] })).toBe(
      "http://upstream.test/api?id=1&id=2",
    );
  });
});

describe("readBody", () => {
  it("parses a JSON body", async () => {
    await expect(readBody(new Response('{"ok":true}'))).resolves.toEqual({
      ok: true,
    });
  });

  it("returns the text when the body is not JSON", async () => {
    await expect(readBody(new Response("Bad Gateway"))).resolves.toBe(
      "Bad Gateway",
    );
  });

  it("returns null for an empty body", async () => {
    await expect(readBody(new Response(null, { status: 204 }))).resolves.toBe(
      null,
    );
  });
});

describe("fetchJson", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the parsed body of a successful response", async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"sessionId":7}'));

    await expect(fetchJson("http://upstream.test/x")).resolves.toEqual({
      sessionId: 7,
    });
  });

  it("passes the request options through to fetch", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}"));
    const init = { method: "POST", body: "{}" };

    await fetchJson("http://upstream.test/x", init);

    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      "http://upstream.test/x",
      init,
    );
  });

  it("throws the status and the parsed body of a failed response", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('{"error":"chat disabled"}', {
        status: 403,
        statusText: "Forbidden",
      }),
    );

    const error = await fetchJson("http://upstream.test/x").catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(HttpStatusError);
    expect(error).toMatchObject({
      status: 403,
      statusText: "Forbidden",
      body: { error: "chat disabled" },
    });
  });

  it("lets a network failure through unchanged", async () => {
    const failure = new TypeError("fetch failed");
    fetchMock.mockRejectedValueOnce(failure);

    await expect(fetchJson("http://upstream.test/x")).rejects.toBe(failure);
  });
});

describe("downloadCapped", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const options = { timeoutMs: 1000, maxBytes: 4 };

  function streamOf(...chunks: number[][]): ReadableStream<Uint8Array> {
    return new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(new Uint8Array(chunk));
        controller.close();
      },
    });
  }

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the whole body when it fits the cap", async () => {
    fetchMock.mockResolvedValueOnce(new Response(streamOf([1, 2], [3, 4])));

    const body = await downloadCapped("http://upstream.test/x", options);

    expect([...body]).toEqual([1, 2, 3, 4]);
  });

  it("refuses a body over the cap that carries no content-length", async () => {
    const response = new Response(streamOf([1, 2, 3], [4, 5]));
    expect(response.headers.get("content-length")).toBeNull();
    fetchMock.mockResolvedValueOnce(response);

    await expect(
      downloadCapped("http://upstream.test/x", options),
    ).rejects.toBeInstanceOf(DownloadTooLargeError);
  });

  it("refuses a declared content-length over the cap before reading", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(streamOf([1]), { headers: { "content-length": "5" } }),
    );

    await expect(
      downloadCapped("http://upstream.test/x", options),
    ).rejects.toBeInstanceOf(DownloadTooLargeError);
  });

  it("throws the status of a failed response", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("gone", { status: 404, statusText: "Not Found" }),
    );

    await expect(
      downloadCapped("http://upstream.test/x", options),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("passes the redirect mode and a timeout signal to fetch", async () => {
    fetchMock.mockResolvedValueOnce(new Response(streamOf([1])));

    await downloadCapped("http://upstream.test/x", {
      ...options,
      redirect: "error",
    });

    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      "http://upstream.test/x",
      expect.objectContaining({
        redirect: "error",
        signal: expect.any(AbortSignal),
      }),
    );
  });
});

describe("describeHttpError", () => {
  it("reports the status of a failed response without its body", () => {
    expect(
      describeHttpError(
        new HttpStatusError(401, "Unauthorized", { token: "secret" }),
      ),
    ).toEqual({
      status: 401,
      statusText: "Unauthorized",
      message: "Request failed with status 401",
    });
  });

  it("reports the cause code of a network failure", () => {
    const failure = new TypeError("fetch failed", {
      cause: { code: "ECONNREFUSED" },
    });

    expect(describeHttpError(failure)).toEqual({
      name: "TypeError",
      code: "ECONNREFUSED",
      message: "fetch failed",
    });
  });

  it("stringifies anything that is not an error", () => {
    expect(describeHttpError("boom")).toEqual({ message: "boom" });
  });
});
