import config from "@/config";
import { getService, Services } from "@/services";

export type RenderPage = "activity" | "compare" | "profile" | "top";

const RENDER_TIMEOUT_MS = 15_000;
const RENDER_VIEWPORT_WIDTH = 900;
const RENDER_VIEWPORT_HEIGHT = 500;

export async function renderScreenshot(
  page: RenderPage,
  params: Record<string, string> = {},
): Promise<Buffer | null> {
  try {
    const puppeteer = await getService(Services.PUPPETEER_SERVICE);
    const renderUrl = new URL(`/render/${page}`, config.puppeteer.baseUrl);

    for (const [key, value] of Object.entries(params)) {
      renderUrl.searchParams.set(key, value);
    }

    const containerSelector = `#${page}-container`;
    const result = await puppeteer.screenshot({
      url: renderUrl.toString(),
      extraHeaders: { "x-render-secret": config.puppeteer.secret },
      waitForSelector: containerSelector,
      elementSelector: containerSelector,
      timeout: RENDER_TIMEOUT_MS,
      viewportWidth: RENDER_VIEWPORT_WIDTH,
      viewportHeight: RENDER_VIEWPORT_HEIGHT,
    });

    return result.buffer;
  } catch (error) {
    logger.warn(
      `Puppeteer screenshot failed for /${page}, falling back to text embed:`,
      error,
    );
    return null;
  }
}
