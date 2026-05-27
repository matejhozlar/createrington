/**
 * Local dev tool: screenshot the /profile render card with every known skin
 * pose, overlaying the pose name on each image. Useful for eyeballing how
 * the skin-api renders look across the pose catalogue inside the card frame.
 *
 * Assumes `pnpm dev` is already running so Vite serves the render page and
 * proxies the data API to the Node server. Requires PUPPETEER_EXECUTABLE_PATH
 * and PUPPETEER_SECRET in the Infisical dev env.
 *
 * Swaps the skin image src via DOM manipulation after the page mounts, so
 * the render page itself does not need to know about a per-pose query param
 * (zero production surface).
 *
 * Usage:
 *   pnpm util:render-profile-poses <discordId>
 *
 * Output: tmp/profile-poses/<pose>.png at the repo root.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";
import puppeteer from "puppeteer-core";
import { KNOWN_POSES } from "@createrington/skin-api-client";
import config from "@/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..", "..", "..", "..");
const OUTPUT_DIR = path.join(REPO_ROOT, "tmp", "profile-poses");

async function waitForImagesToLoad(
  page: import("puppeteer-core").Page,
): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    const imgs = Array.from(
      document.querySelectorAll<HTMLImageElement>("#profile-container img"),
    );
    await Promise.all(
      imgs.map((img) =>
        img.complete
          ? null
          : new Promise<void>((resolve) => {
              img.addEventListener("load", () => resolve(), { once: true });
              img.addEventListener("error", () => resolve(), { once: true });
            }),
      ),
    );
  });
}

async function main() {
  const playerId = process.argv[2];
  if (!playerId) {
    console.error("Usage: pnpm util:render-profile-poses <discordId>");
    process.exit(1);
  }

  const { executablePath, secret, baseUrl } = config.puppeteer;
  if (!executablePath) {
    console.error("PUPPETEER_EXECUTABLE_PATH not set");
    process.exit(1);
  }
  if (!secret) {
    console.error("PUPPETEER_SECRET not set");
    process.exit(1);
  }

  await mkdir(OUTPUT_DIR, { recursive: true });
  console.log(`Output: ${OUTPUT_DIR}`);
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Poses: ${KNOWN_POSES.length}\n`);

  // UUID is extracted from the first rendered skin <img> src (filled in
  // during the first iteration). The page already knows it via its data
  // fetch, so the script doesn't need to call the data API directly.
  let uuid: string | null = null;

  const browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
    ],
  });

  try {
    for (const pose of KNOWN_POSES) {
      process.stdout.write(`  ${pose.padEnd(12)} ... `);
      const page = await browser.newPage();
      try {
        await page.setViewport({ width: 900, height: 500 });
        await page.setExtraHTTPHeaders({ "x-render-secret": secret });

        const url = new URL("/render/profile", baseUrl);
        url.searchParams.set("player", playerId);
        await page.goto(url.toString(), {
          waitUntil: "domcontentloaded",
          timeout: 30_000,
        });
        await page.waitForSelector("#profile-container", { timeout: 30_000 });

        await waitForImagesToLoad(page);

        if (!uuid) {
          uuid = await page.evaluate(() => {
            const imgs = Array.from(
              document.querySelectorAll<HTMLImageElement>(
                "#profile-container img",
              ),
            );
            const skinImg = imgs.find(
              (img) =>
                img.src.includes("/api/render/skin") ||
                img.src.includes("mc-heads.net/body"),
            );
            if (!skinImg) return null;
            try {
              const parsed = new URL(skinImg.src);
              const queryUuid = parsed.searchParams.get("uuid");
              if (queryUuid) return queryUuid;
              const parts = parsed.pathname.split("/").filter(Boolean);
              return parts[parts.length - 1] ?? null;
            } catch {
              return null;
            }
          });
          if (!uuid) throw new Error("Could not extract uuid from skin img");
          console.log(`(Detected UUID: ${uuid})\n`);
        }

        const newSrc = `/api/render/skin?uuid=${encodeURIComponent(
          uuid,
        )}&pose=${encodeURIComponent(pose)}`;
        await page.evaluate((src) => {
          const imgs = Array.from(
            document.querySelectorAll<HTMLImageElement>(
              "#profile-container img",
            ),
          );
          const skinImg = imgs.find(
            (img) =>
              img.src.includes("/api/render/skin") ||
              img.src.includes("mc-heads.net/body"),
          );
          if (skinImg) skinImg.src = src;
        }, newSrc);

        await waitForImagesToLoad(page);

        await page.evaluate((poseName) => {
          const container = document.getElementById("profile-container");
          if (!container) return;
          const label = document.createElement("div");
          label.textContent = `pose: ${poseName}`;
          label.style.cssText = [
            "position:absolute",
            "top:10px",
            "left:50%",
            "transform:translateX(-50%)",
            "background:rgba(0,0,0,0.75)",
            "color:#fff",
            "padding:5px 14px",
            "border-radius:6px",
            "font-family:ui-monospace,SFMono-Regular,Menlo,monospace",
            "font-size:13px",
            "font-weight:600",
            "letter-spacing:0.06em",
            "z-index:100",
          ].join(";");
          container.appendChild(label);
        }, pose);

        const element = await page.$("#profile-container");
        if (!element) throw new Error("container element vanished");

        const buffer = (await element.screenshot({ type: "png" })) as Buffer;
        const outPath = path.join(OUTPUT_DIR, `${pose}.png`);
        await writeFile(outPath, buffer);
        process.stdout.write(`ok (${buffer.length} bytes)\n`);
      } finally {
        await page.close().catch(() => {});
      }
    }
    console.log(`\nDone. ${KNOWN_POSES.length} screenshots in ${OUTPUT_DIR}`);
  } finally {
    await browser.close().catch(() => {});
  }
}

main().catch((err) => {
  console.error("\nFailed:", err);
  process.exit(1);
});
