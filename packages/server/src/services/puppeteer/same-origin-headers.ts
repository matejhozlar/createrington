import type { Page } from "puppeteer-core";

export async function setSameOriginHeaders(
  page: Page,
  url: string,
  headers: Record<string, string>,
): Promise<void> {
  const { origin } = new URL(url);

  await page.setRequestInterception(true);
  page.on("request", (request) => {
    const overrides =
      URL.parse(request.url())?.origin === origin
        ? { headers: { ...request.headers(), ...headers } }
        : {};
    request.continue(overrides).catch(() => {});
  });
}
