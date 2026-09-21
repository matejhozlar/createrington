import type { Page } from "puppeteer-core";

export async function setSameOriginHeaders(
  page: Page,
  url: string,
  headers: Record<string, string>,
): Promise<void> {
  const { origin } = new URL(url);
  const lowercased = Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]),
  );

  page.on("request", (request) => {
    const overrides =
      URL.parse(request.url())?.origin === origin
        ? { headers: { ...request.headers(), ...lowercased } }
        : {};
    request.continue(overrides).catch(() => {});
  });
  await page.setRequestInterception(true);
}
