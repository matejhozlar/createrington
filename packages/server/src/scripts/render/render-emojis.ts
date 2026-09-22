import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import sharp from "sharp";
import { getIconData, iconToSVG } from "@iconify/utils";
import {
  APP_EMOJI_DEFAULTS,
  APP_EMOJI_KEYS,
  APP_EMOJI_NAME_PATTERN,
  APP_EMOJIS,
  appEmojiAssetDir,
  type AppEmojiKey,
  type AppEmojiSpec,
} from "@/discord/emojis";

const require = createRequire(import.meta.url);

const EMOJI_SIZE = 128;

type IconSet = Parameters<typeof getIconData>[0];

const iconSets = new Map<string, IconSet>();

function loadIconSet(set: string): IconSet {
  const cached = iconSets.get(set);
  if (cached) return cached;

  let data: IconSet;
  try {
    data = require(`@iconify-json/${set}/icons.json`) as IconSet;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "MODULE_NOT_FOUND") {
      throw error;
    }
    throw new Error(
      `Icon set "${set}" is not installed. Run: pnpm add -D --filter @createrington/server @iconify-json/${set}`,
    );
  }
  iconSets.set(set, data);
  return data;
}

function buildSvg(key: AppEmojiKey): string {
  const spec: AppEmojiSpec = APP_EMOJIS[key];
  const [set, name] = spec.icon.split(":");
  const data = getIconData(loadIconSet(set), name);
  if (!data) {
    throw new Error(`Icon "${spec.icon}" (emoji "${key}") does not exist`);
  }

  const rendered = iconToSVG(data, { height: EMOJI_SIZE });
  const color = spec.color ?? APP_EMOJI_DEFAULTS.color;
  const strokeWidth = spec.strokeWidth ?? APP_EMOJI_DEFAULTS.strokeWidth;
  let strokeReplacements = 0;
  const body = rendered.body
    .replaceAll("currentColor", color)
    .replace(/stroke-width="[\d.]+"/g, () => {
      strokeReplacements++;
      return `stroke-width="${strokeWidth}"`;
    });
  if (spec.strokeWidth !== undefined && strokeReplacements === 0) {
    throw new Error(
      `Emoji "${key}" sets strokeWidth but "${spec.icon}" has no stroke to apply it to`,
    );
  }

  const { width, height, viewBox } = rendered.attributes;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewBox}">${body}</svg>`;
}

async function renderEmojis(): Promise<void> {
  const outDir = appEmojiAssetDir();
  await fs.mkdir(outDir, { recursive: true });

  console.log(`Rendering ${APP_EMOJI_KEYS.length} application emojis...\n`);

  const rendered = new Set<string>();
  for (const key of APP_EMOJI_KEYS) {
    if (!APP_EMOJI_NAME_PATTERN.test(key)) {
      throw new Error(
        `Emoji key "${key}" must be 2-32 letters, digits, or underscores`,
      );
    }

    const png = await sharp(Buffer.from(buildSvg(key)))
      .png()
      .toBuffer();
    const file = `${key}.png`;
    await fs.writeFile(path.join(outDir, file), png);
    rendered.add(file);
    console.log(`   ✓ ${key} (${APP_EMOJIS[key].icon}, ${png.length} bytes)`);
  }

  for (const file of await fs.readdir(outDir)) {
    if (file.endsWith(".png") && !rendered.has(file)) {
      await fs.unlink(path.join(outDir, file));
      console.log(`   - removed stale ${file}`);
    }
  }

  console.log(`\nRendered ${rendered.size} emojis into ${outDir}`);
}

renderEmojis().catch((error) => {
  console.error("\nFailed to render application emojis:");
  console.error(error);
  process.exit(1);
});
