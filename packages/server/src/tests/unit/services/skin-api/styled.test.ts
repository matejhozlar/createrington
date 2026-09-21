import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config", () => ({
  default: {
    skinApi: { baseUrl: "https://skin-api.test/", apiKey: "secret-key" },
  },
}));

import { MAX_QUALITY_STYLED_RENDER } from "@/services/skin-api/quality";
import { renderStyledSkin } from "@/services/skin-api/styled";
import { SkinApiError } from "createrington-skin-api";

const PARAMS = { uuid: "uuid-1", pose: "wave", style: "cel" } as const;

function stubFetch(response: Response | Error) {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => {
    if (response instanceof Error) throw response;
    return response;
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function failingBody(error: Error): Response {
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.error(error);
      },
    }),
  );
}

async function rejection(promise: Promise<unknown>): Promise<SkinApiError> {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(SkinApiError);
  return error as SkinApiError;
}

describe("renderStyledSkin", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("asks the render endpoint for the style inside the styled size cap", async () => {
    const fetchMock = stubFetch(new Response(Buffer.from("png-bytes")));

    const png = await renderStyledSkin(PARAMS);

    expect(Buffer.from(png).toString()).toBe("png-bytes");
    const [rawUrl, init] = fetchMock.mock.calls[0]!;
    const url = new URL(rawUrl);
    expect(url.origin + url.pathname).toBe("https://skin-api.test/v1/render");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      uuid: "uuid-1",
      pose: "wave",
      width: String(MAX_QUALITY_STYLED_RENDER.width),
      height: String(MAX_QUALITY_STYLED_RENDER.height),
      style: "cel",
    });
    expect(init?.headers).toMatchObject({
      authorization: "Bearer secret-key",
    });
  });

  it("keeps the styled canvas inside the API's 1024px cap", () => {
    expect(MAX_QUALITY_STYLED_RENDER.width).toBeLessThanOrEqual(1024);
    expect(MAX_QUALITY_STYLED_RENDER.height).toBeLessThanOrEqual(1024);
  });

  it("surfaces the API's refusal as a typed SkinApiError", async () => {
    stubFetch(
      Response.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "Render styles require a premium account",
          },
        },
        { status: 403 },
      ),
    );

    const error = await rejection(renderStyledSkin(PARAMS));

    expect(error.status).toBe(403);
    expect(error.code).toBe("forbidden");
    expect(error.message).toBe("Render styles require a premium account");
  });

  it("prefers the API's own error code over the one implied by the status", async () => {
    stubFetch(
      Response.json(
        { error: { code: "RENDER_FAILED", message: "renderer crashed" } },
        { status: 500 },
      ),
    );

    const error = await rejection(renderStyledSkin(PARAMS));

    expect(error.code).toBe("render_failed");
    expect(error.status).toBe(500);
  });

  it("carries the retry hint of a rate limit", async () => {
    stubFetch(
      Response.json(
        {
          error: {
            code: "RATE_LIMITED",
            message: "slow down",
            retryAfterMs: 1500,
          },
        },
        { status: 429 },
      ),
    );

    const error = await rejection(renderStyledSkin(PARAMS));

    expect(error.code).toBe("rate_limited");
    expect(error.retryAfterMs).toBe(1500);
  });

  it("tells an unavailable skin-api apart when the error body is not JSON", async () => {
    stubFetch(new Response("bad gateway", { status: 502 }));

    const error = await rejection(renderStyledSkin(PARAMS));

    expect(error.status).toBe(502);
    expect(error.code).toBe("upstream_unavailable");
    expect(error.message).toBe("skin-api responded 502");
  });

  it("falls back to unknown for a status and code it does not recognise", async () => {
    stubFetch(Response.json({ error: { code: "TEAPOT" } }, { status: 418 }));

    const error = await rejection(renderStyledSkin(PARAMS));

    expect(error.code).toBe("unknown");
    expect(error.status).toBe(418);
  });

  it("reports a timeout and a network failure as client-side errors", async () => {
    stubFetch(new DOMException("timed out", "TimeoutError"));
    const timeout = await rejection(renderStyledSkin(PARAMS));
    expect(timeout.code).toBe("timeout");
    expect(timeout.status).toBe(0);

    stubFetch(new TypeError("fetch failed"));
    const network = await rejection(renderStyledSkin(PARAMS));
    expect(network.code).toBe("network_error");
    expect(network.status).toBe(0);
  });

  it("maps a failure while the body is still downloading the same way", async () => {
    stubFetch(failingBody(new DOMException("timed out", "TimeoutError")));
    const timeout = await rejection(renderStyledSkin(PARAMS));
    expect(timeout.code).toBe("timeout");

    stubFetch(failingBody(new TypeError("terminated")));
    const reset = await rejection(renderStyledSkin(PARAMS));
    expect(reset.code).toBe("network_error");
    expect(reset.status).toBe(0);
  });
});
