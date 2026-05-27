import puppeteer, { type Browser, type Page } from "puppeteer-core";
import config from "@/config";

export interface ScreenshotOptions {
  /** URL to navigate to */
  url: string;
  /** Extra HTTP headers attached to every request the page makes (including subresource fetches) */
  extraHeaders?: Record<string, string>;
  /** CSS selector to wait for before capturing (optional, defaults to full page) */
  waitForSelector?: string;
  /** CSS selector of the element to screenshot (optional, defaults to full page) */
  elementSelector?: string;
  /**
   * Wait for `document.fonts.ready` and all `<img>` elements to finish loading
   * before capturing. Defaults to true.
   */
  waitForAssets?: boolean;
  /** Extra delay in ms after selector is found, to let animations/charts settle */
  settleDelay?: number;
  /** Navigation timeout in ms (default: 30000) */
  timeout?: number;
  /** Viewport width (default: 1280) */
  viewportWidth?: number;
  /** Viewport height (default: 720) */
  viewportHeight?: number;
  /** Image format (default: "png") */
  format?: "png" | "jpeg" | "webp";
  /** JPEG/WebP quality 0-100 (ignored for png) */
  quality?: number;
}

export interface ScreenshotResult {
  buffer: Buffer;
  format: "png" | "jpeg" | "webp";
}

const LAUNCH_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-gpu",
  "--disable-dev-shm-usage",
  "--disable-extensions",
  "--disable-background-networking",
  "--disable-default-apps",
  "--disable-sync",
  "--disable-translate",
  "--metrics-recording-only",
  "--no-first-run",
];

/**
 * Headless browser for server-side rendering tasks: screenshots of full URLs or
 * specific DOM elements and arbitrary page scripting via `withPage()`. Uses
 * puppeteer-core, so the Chromium executable is not bundled; production requires
 * `PUPPETEER_EXECUTABLE_PATH`. The browser launches lazily on first use, concurrent
 * launches share a single promise, and disconnect handlers null out the cached
 * instance so the next call relaunches transparently.
 */
export class PuppeteerService {
  private browser: Browser | null = null;
  private launching: Promise<Browser> | null = null;

  /** No-op aside from logging; the browser launches lazily on the first `screenshot()` or `withPage()` call. */
  async initialize(): Promise<void> {
    logger.info(
      "PuppeteerService initialized (browser will launch on first use)",
    );
  }

  /** Closes the browser process if one is running; safe to call when no browser was launched. */
  async shutdown(): Promise<void> {
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
      this.launching = null;
      logger.info("PuppeteerService shut down");
    }
  }

  /**
   * Renders a URL (or one element on it) to an image buffer. Waits for fonts and images
   * to settle by default, capped at 10s so a stuck asset cannot stall the request.
   */
  async screenshot(options: ScreenshotOptions): Promise<ScreenshotResult> {
    const {
      url,
      extraHeaders,
      waitForSelector,
      elementSelector,
      waitForAssets = true,
      settleDelay = 0,
      timeout = 30_000,
      viewportWidth = 1280,
      viewportHeight = 720,
      format = "png",
      quality,
    } = options;

    const browser = await this.getBrowser();
    let page: Page | null = null;

    try {
      page = await browser.newPage();
      await page.setViewport({ width: viewportWidth, height: viewportHeight });

      if (extraHeaders) {
        await page.setExtraHTTPHeaders(extraHeaders);
      }

      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout,
      });

      if (waitForSelector) {
        await page.waitForSelector(waitForSelector, { timeout });
      }

      if (waitForAssets) {
        const assetWait = page.evaluate(async () => {
          await document.fonts.ready;
          await Promise.all(
            Array.from(document.images).map((img) =>
              img.complete
                ? null
                : new Promise<void>((resolve) => {
                    img.addEventListener("load", () => resolve(), {
                      once: true,
                    });
                    img.addEventListener("error", () => resolve(), {
                      once: true,
                    });
                  }),
            ),
          );
        });
        const ceiling = new Promise<void>((resolve) =>
          setTimeout(resolve, 10_000),
        );
        await Promise.race([assetWait, ceiling]);
      }

      if (settleDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, settleDelay));
      }

      const screenshotOpts: Parameters<Page["screenshot"]>[0] = {
        type: format,
        ...(format !== "png" && quality != null ? { quality } : {}),
      };

      let buffer: Buffer;

      if (elementSelector) {
        const element = await page.$(elementSelector);
        if (!element) {
          throw new Error(`Element not found for selector: ${elementSelector}`);
        }
        buffer = (await element.screenshot(screenshotOpts)) as Buffer;
      } else {
        buffer = (await page.screenshot({
          ...screenshotOpts,
          fullPage: true,
        })) as Buffer;
      }

      return { buffer, format };
    } finally {
      if (page) {
        await page.close().catch(() => {});
      }
    }
  }

  /** Runs `fn` against a fresh page; the page is closed whether the callback resolves or throws. */
  async withPage<T>(
    fn: (page: Page, browser: Browser) => Promise<T>,
  ): Promise<T> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      return await fn(page, browser);
    } finally {
      await page.close().catch(() => {});
    }
  }

  private async getBrowser(): Promise<Browser> {
    if (this.browser?.connected) {
      return this.browser;
    }

    // Avoid launching multiple browsers concurrently
    if (this.launching) {
      return this.launching;
    }

    this.launching = this.launchBrowser();

    try {
      this.browser = await this.launching;
      return this.browser;
    } finally {
      this.launching = null;
    }
  }

  private async launchBrowser(): Promise<Browser> {
    logger.info("Launching Puppeteer browser...");

    const executablePath =
      config.puppeteer.executablePath ??
      (config.envMode.isProd ? "/usr/bin/chromium-browser" : undefined);

    if (!executablePath) {
      throw new Error(
        "puppeteer-core requires an executablePath. Set PUPPETEER_EXECUTABLE_PATH in .env",
      );
    }

    const browser = await puppeteer.launch({
      headless: true,
      args: LAUNCH_ARGS,
      executablePath,
    });

    browser.on("disconnected", () => {
      logger.warn("Puppeteer browser disconnected, will re-launch on next use");
      this.browser = null;
    });

    logger.info("Puppeteer browser launched");
    return browser;
  }
}
