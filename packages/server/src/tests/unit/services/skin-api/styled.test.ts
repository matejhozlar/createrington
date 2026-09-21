import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config", () => ({
  default: {
    skinApi: { baseUrl: "https://skin-api.test/", apiKey: "secret-key" },
  },
}));

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

    expect(png.toString()).toBe("png-bytes");
    const [rawUrl, init] = fetchMock.mock.calls[0]!;
    const url = new URL(rawUrl);
    expect(url.origin + url.pathname).toBe("https://skin-api.test/v1/render");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      uuid: "uuid-1",
      pose: "wave",
      width: "683",
      height: "1024",
      style: "cel",
    });
    expect(init?.headers).toMatchObject({
      authorization: "Bearer secret-key",
    });
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

  it("still throws a SkinApiError when the error body is not JSON", async () => {
    stubFetch(new Response("bad gateway", { status: 502 }));

    const error = await rejection(renderStyledSkin(PARAMS));

    expect(error.status).toBe(502);
    expect(error.code).toBe("unknown");
    expect(error.message).toBe("skin-api responded 502");
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
});
