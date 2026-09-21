import { describe, it, expect, vi } from "vitest";
import type { HTTPRequest, Page } from "puppeteer-core";
import { setSameOriginHeaders } from "@/services/puppeteer/same-origin-headers";

const TARGET = "http://127.0.0.1:5001/render/activity?player=1";
const SECRET = { "x-render-secret": "s3cret" };

async function interceptedPage(headers: Record<string, string>) {
  let listener: ((request: HTTPRequest) => void) | undefined;
  const page = {
    on: vi.fn((_event: string, handler: (request: HTTPRequest) => void) => {
      listener = handler;
    }),
    setRequestInterception: vi.fn(async () => {}),
  };

  await setSameOriginHeaders(page as unknown as Page, TARGET, headers);

  const send = (
    url: string,
    requestHeaders: Record<string, string> = {},
    outcome: () => Promise<void> = () => Promise.resolve(),
  ) => {
    const continued: unknown[] = [];
    const request = {
      url: () => url,
      headers: () => requestHeaders,
      continue: (overrides: unknown) => {
        continued.push(overrides);
        return outcome();
      },
    };
    listener?.(request as unknown as HTTPRequest);
    return continued;
  };

  return { page, send };
}

describe("setSameOriginHeaders", () => {
  it("enables request interception on the page", async () => {
    const { page } = await interceptedPage(SECRET);

    expect(page.setRequestInterception).toHaveBeenCalledWith(true);
  });

  it("adds the headers to requests for the target origin, keeping the browser's own", async () => {
    const { send } = await interceptedPage(SECRET);

    const continued = send(
      "http://127.0.0.1:5001/api/render/activity?player=1",
      { accept: "application/json" },
    );

    expect(continued).toEqual([
      { headers: { accept: "application/json", "x-render-secret": "s3cret" } },
    ]);
  });

  it.each([
    ["a third-party host", "https://mc-heads.net/avatar/069a79f4"],
    ["a host alias of the target", "http://localhost:5001/api/render/activity"],
    [
      "another port on the target host",
      "http://127.0.0.1:5002/api/render/activity",
    ],
    [
      "another scheme on the target host",
      "https://127.0.0.1:5001/api/render/activity",
    ],
    ["an unparseable url", "not a url"],
  ])("continues %s without the headers", async (_label, url) => {
    const { send } = await interceptedPage(SECRET);

    expect(send(url, { accept: "image/*" })).toEqual([{}]);
  });

  it("replaces a header the browser already sends regardless of the caller's casing", async () => {
    const { send } = await interceptedPage({ "User-Agent": "renderer" });

    const continued = send(TARGET, { "user-agent": "HeadlessChrome" });

    expect(continued).toEqual([{ headers: { "user-agent": "renderer" } }]);
  });

  it("absorbs a rejected continue instead of leaving an unhandled rejection", async () => {
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);

    try {
      const { send } = await interceptedPage(SECRET);
      send(TARGET, {}, () => Promise.reject(new Error("Invalid header")));
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off("unhandledRejection", unhandled);
    }
  });
});
