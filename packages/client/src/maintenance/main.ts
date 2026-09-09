import "./maintenance.css";
import {
  mountSkinRunner,
  readPlayerHint,
  type RunnerState,
} from "@/lib/skin-runner";

const POLL_INTERVAL_MS = 15000;
const RELOAD_DELAY_MS = 1500;
const SELF_PATH = "/maintenance.html";

const canvas = document.querySelector<HTMLCanvasElement>("#runner");
const nameLabel = document.querySelector<HTMLElement>("#player-name");
const deploying = document.querySelector<HTMLElement>("#deploying");
const backOnlineBanner = document.querySelector<HTMLElement>("#back-online");

const player = readPlayerHint();
if (nameLabel) nameLabel.textContent = player.username;

let state: RunnerState = "loading";
let backOnline = false;
let reloadTimer: number | null = null;

function scheduleReload(): void {
  if (reloadTimer !== null) return;
  reloadTimer = window.setTimeout(
    () => window.location.reload(),
    RELOAD_DELAY_MS,
  );
}

function handleState(next: RunnerState): void {
  state = next;
  if (backOnline && next !== "running") scheduleReload();
}

if (canvas) {
  mountSkinRunner(canvas, {
    uuid: player.uuid,
    username: player.username,
    onStateChange: handleState,
  });
}

async function probe(): Promise<boolean> {
  try {
    const response = await fetch(`/?probe=${Date.now()}`, {
      method: "HEAD",
      cache: "no-store",
    });
    return response.ok && response.headers.get("retry-after") === null;
  } catch {
    return false;
  }
}

async function poll(): Promise<void> {
  if (await probe()) {
    backOnline = true;
    if (deploying) deploying.hidden = true;
    if (backOnlineBanner) backOnlineBanner.hidden = false;
    if (state !== "running") scheduleReload();
    return;
  }
  window.setTimeout(() => void poll(), POLL_INTERVAL_MS);
}

if (window.location.pathname !== SELF_PATH) {
  window.setTimeout(() => void poll(), POLL_INTERVAL_MS);
}
