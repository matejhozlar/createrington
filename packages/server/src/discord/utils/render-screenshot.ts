import config from "@/config";
import { getService, Services } from "@/services";

type RenderParams = {
  activity: { player: string };
  compare: { player1: string; player2: string };
  profile: { player: string };
  records: Record<string, never>;
  top: { category: string; item: string };
};

type RenderPage = keyof RenderParams;

type CachedRender = {
  buffer: Promise<Buffer | null>;
  expiresAt: number;
};

const RENDER_TIMEOUT_MS = 15_000;
const RENDER_UNAVAILABLE_SELECTOR = "#render-unavailable";
const RENDER_VIEWPORT_WIDTH = 900;
const RENDER_VIEWPORT_HEIGHT = 500;
const RENDER_CACHE_TTL_MS: Partial<Record<RenderPage, number>> = {
  records: 60_000,
};

const renderCache = new Map<string, CachedRender>();

export async function renderScreenshot<P extends RenderPage>(
  page: P,
  params: RenderParams[P],
): Promise<Buffer | null> {
  const renderUrl = new URL(`/render/${page}`, config.puppeteer.baseUrl);

  for (const [key, value] of Object.entries<string>(params)) {
    renderUrl.searchParams.set(key, value);
  }

  const ttl = RENDER_CACHE_TTL_MS[page];
  if (!ttl) {
    return capture(page, renderUrl);
  }

  const cacheKey = renderUrl.toString();
  const cached = renderCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.buffer;
  }

  const entry: CachedRender = {
    buffer: capture(page, renderUrl),
    expiresAt: Infinity,
  };
  renderCache.set(cacheKey, entry);

  const buffer = await entry.buffer;

  if (renderCache.get(cacheKey) === entry) {
    if (buffer) {
      entry.expiresAt = Date.now() + ttl;
    } else {
      renderCache.delete(cacheKey);
    }
  }

  return buffer;
}

async function capture(
  page: RenderPage,
  renderUrl: URL,
): Promise<Buffer | null> {
  try {
    const puppeteer = await getService(Services.PUPPETEER_SERVICE);
    const containerSelector = `#${page}-container`;
    const result = await puppeteer.screenshot({
      url: renderUrl.toString(),
      extraHeaders: { "x-render-secret": config.puppeteer.secret },
      waitForSelector: containerSelector,
      abortSelector: RENDER_UNAVAILABLE_SELECTOR,
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
