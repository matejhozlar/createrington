import fs from "fs";
import path from "path";

import { OG_ROUTES } from "./og-meta.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.join(ROOT, "dist");

const SERVER_DIST = path.join(ROOT, "packages/server/dist");
const CLIENT_DIST = path.join(ROOT, "packages/client/dist");

const SITE_URL = "https://createrington.com";
const FALLBACK_IMAGE = `${SITE_URL}/assets/og/og-card.png`;
const CARD_W = 1200;
const CARD_H = 630;

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

function escapeAttr(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function swapTag(html, re, value, what) {
  if (!re.test(html)) {
    throw new Error(`og-html: no ${what} in built index.html`);
  }
  return html.replace(re, (_, pre, post) => `${pre}${value}${post}`);
}

function setMeta(html, attr, key, value) {
  return swapTag(
    html,
    new RegExp(`(<meta\\s+${attr}="${key}"[^>]*?content=")[^"]*(")`),
    escapeAttr(value),
    `<meta ${attr}="${key}">`,
  );
}

// Every <route>.png under assets/og/ (except the global og-card.png fallback)
// becomes og-html/<route>.html: the built index.html with its social meta
// swapped. Nginx serves these via
// `try_files $uri $uri/ /og-html$uri.html /index.html`.
function generateOgHtml() {
  const publicDir = path.join(DIST, "public");
  const ogDir = path.join(publicDir, "assets", "og");
  if (!fs.existsSync(ogDir)) {
    throw new Error(`og-html: ${ogDir} is missing from the built client`);
  }

  const base = fs.readFileSync(path.join(publicDir, "index.html"), "utf8");
  if (!base.includes(FALLBACK_IMAGE)) {
    throw new Error(
      `og-html: built index.html does not reference ${FALLBACK_IMAGE}`,
    );
  }

  const cards = fs
    .readdirSync(ogDir, { recursive: true })
    .map((entry) => entry.split(path.sep).join("/"))
    .filter((entry) => entry.endsWith(".png") && entry !== "og-card.png");

  const routes = new Set();
  for (const card of cards) {
    const route = `/${card.slice(0, -".png".length)}`;
    routes.add(route);

    const png = fs.readFileSync(path.join(ogDir, card));
    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);
    if (width !== CARD_W || height !== CARD_H) {
      throw new Error(
        `og-html: ${card} is ${width}x${height}, og:image:width/height advertise ${CARD_W}x${CARD_H}`,
      );
    }

    const meta = OG_ROUTES[route];

    let html = base.replaceAll(FALLBACK_IMAGE, `${SITE_URL}/assets/og/${card}`);
    html = setMeta(html, "property", "og:url", `${SITE_URL}${route}`);
    html = swapTag(
      html,
      /(<link\s+rel="canonical"\s+href=")[^"]*(")/,
      `${SITE_URL}${route}`,
      '<link rel="canonical">',
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

  const unmatched = Object.keys(OG_ROUTES).filter(
    (route) => !routes.has(route),
  );
  if (unmatched.length > 0) {
    throw new Error(
      `og-html: OG_ROUTES entries with no matching card image: ${unmatched.join(", ")}`,
    );
  }
}
