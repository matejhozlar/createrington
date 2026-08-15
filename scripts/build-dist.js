import fs from "fs";
import path from "path";

import { OG_ROUTES } from "./og-meta.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.join(ROOT, "dist");

const SERVER_DIST = path.join(ROOT, "packages/server/dist");
const CLIENT_DIST = path.join(ROOT, "packages/client/dist");

const SITE_URL = "https://createrington.com";
const FALLBACK_IMAGE = `${SITE_URL}/assets/og/og-card.png`;

fs.rmSync(DIST, { recursive: true, force: true });

fs.cpSync(SERVER_DIST, DIST, {
  recursive: true,
  filter: (src) => !src.endsWith(".d.ts"),
});

fs.cpSync(CLIENT_DIST, path.join(DIST, "public"), { recursive: true });

const changelogSrc = path.join(ROOT, "CHANGELOG.md");
if (fs.existsSync(changelogSrc)) {
  fs.cpSync(changelogSrc, path.join(DIST, "CHANGELOG.md"));
}

generateOgHtml();

console.log("Build assembled in dist/");

function setMeta(html, attr, key, value) {
  const re = new RegExp(`(<meta\\s+${attr}="${key}"[\\s\\S]*?content=")[^"]*(")`);
  if (!re.test(html)) {
    throw new Error(`og-html: no <meta ${attr}="${key}"> in built index.html`);
  }
  return html.replace(re, `$1${value}$2`);
}

// Every <route>.png under assets/og/ (except the global og-card.png fallback)
// becomes og-html/<route>.html: the built index.html with its social meta
// swapped. Nginx serves these via
// `try_files $uri $uri/ /og-html$uri.html /index.html`.
function generateOgHtml() {
  const publicDir = path.join(DIST, "public");
  const ogDir = path.join(publicDir, "assets", "og");
  if (!fs.existsSync(ogDir)) return;

  const base = fs.readFileSync(path.join(publicDir, "index.html"), "utf8");
  if (!base.includes(FALLBACK_IMAGE)) {
    throw new Error(`og-html: built index.html does not reference ${FALLBACK_IMAGE}`);
  }

  const cards = fs
    .readdirSync(ogDir, { recursive: true })
    .map((entry) => entry.split(path.sep).join("/"))
    .filter((entry) => entry.endsWith(".png") && entry !== "og-card.png");

  for (const card of cards) {
    const route = `/${card.slice(0, -".png".length)}`;
    const meta = OG_ROUTES[route];

    let html = base.replaceAll(FALLBACK_IMAGE, `${SITE_URL}/assets/og/${card}`);
    html = setMeta(html, "property", "og:url", `${SITE_URL}${route}`);
    html = html.replace(
      /(<link\s+rel="canonical"\s+href=")[^"]*(")/,
      `$1${SITE_URL}${route}$2`,
    );
    if (meta?.title) {
      html = setMeta(html, "property", "og:title", meta.title);
      html = setMeta(html, "name", "twitter:title", meta.title);
    }
    if (meta?.description) {
      html = setMeta(html, "name", "description", meta.description);
      html = setMeta(html, "property", "og:description", meta.description);
      html = setMeta(html, "name", "twitter:description", meta.description);
    }
    if (meta?.imageAlt) {
      html = setMeta(html, "property", "og:image:alt", meta.imageAlt);
      html = setMeta(html, "name", "twitter:image:alt", meta.imageAlt);
    }

    const outFile = path.join(publicDir, "og-html", `${route.slice(1)}.html`);
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, html);
    console.log(`og-html: ${route}`);
  }
}
