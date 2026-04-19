import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const MARKETING_ROOT = path.resolve(path.dirname(__filename), "..");

const SRC = path.join(MARKETING_ROOT, "assets", "audio", "brass-railworks.wav");
const OUT = path.join(MARKETING_ROOT, "assets", "audio", "brass-railworks.m4a");

if (!existsSync(SRC)) {
  console.error(`[build-audio] missing source: ${SRC}`);
  process.exit(1);
}

// Compute video duration in seconds from src/theme.ts so the audio stays in
// sync if scene lengths change.
const themeSrc = readFileSync(path.join(MARKETING_ROOT, "src", "theme.ts"), "utf-8");
const durationsBlock = themeSrc.match(/DURATIONS\s*=\s*\{([^}]+)\}/s);
if (!durationsBlock) {
  console.error("[build-audio] couldn't parse DURATIONS from src/theme.ts");
  process.exit(1);
}
const frames = [...durationsBlock[1].matchAll(/:\s*(\d+)/g)]
  .map((m) => parseInt(m[1], 10))
  .reduce((a, b) => a + b, 0);
const fpsMatch = themeSrc.match(/FPS\s*=\s*(\d+)/);
if (!fpsMatch) {
  console.error("[build-audio] couldn't parse FPS from src/theme.ts");
  process.exit(1);
}
const fps = parseInt(fpsMatch[1], 10);
const videoSeconds = frames / fps;

// Probe source audio duration, then compute the atempo factor that compresses
// it to match the video. atempo preserves pitch (unlike naive playbackRate).
const srcDuration = parseFloat(
  execSync(
    `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${SRC}"`,
    { encoding: "utf-8" },
  ).trim(),
);
const atempo = srcDuration / videoSeconds;

console.log(
  `[build-audio] video ${videoSeconds.toFixed(2)}s (${frames}f @ ${fps}fps), ` +
    `source ${srcDuration.toFixed(2)}s, atempo=${atempo.toFixed(4)}`,
);

execSync(
  `ffmpeg -y -i "${SRC}" -filter:a "atempo=${atempo}" -c:a aac -b:a 192k "${OUT}"`,
  { stdio: "inherit" },
);

console.log(`[build-audio] wrote ${path.relative(MARKETING_ROOT, OUT)}`);
