import puppeteer, { type Browser, type Page } from "puppeteer-core";
import config from "@/config";

export interface ScreenshotOptions {
  /** URL to navigate to */
  url: string;
  /** CSS selector to wait for before capturing (optional — defaults to full page) */
  waitForSelector?: string;
  /** CSS selector of the element to screenshot (optional — defaults to full page) */
  elementSelector?: string;
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

export class PuppeteerService {
  private browser: Browser | null = null;
  private launching: Promise<Browser> | null = null;

  async initialize(): Promise<void> {
    // Browser launches lazily on first use — no eager startup cost
    logger.info("PuppeteerService initialized (browser will launch on first use)");
  }

  async shutdown(): Promise<void> {
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
      this.launching = null;
      logger.info("PuppeteerService shut down");
    }
  }

  /**
   * Take a screenshot of a URL or a specific element on the page.
   */
  async screenshot(options: ScreenshotOptions): Promise<ScreenshotResult> {
    const {
      url,
      waitForSelector,
      elementSelector,
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

      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout,
      });

      if (waitForSelector) {
        await page.waitForSelector(waitForSelector, { timeout });
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

  /**
   * Execute an arbitrary async callback with a fresh page.
   * The page is automatically closed when the callback completes.
   */
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

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

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

    const executablePath = config.puppeteer.executablePath
      ?? (config.envMode.isProd ? "/usr/bin/chromium-browser" : undefined);

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
      logger.warn(
        "Puppeteer browser disconnected — will re-launch on next use",
      );
      this.browser = null;
    });

    logger.info("Puppeteer browser launched");
    return browser;
  }
}
