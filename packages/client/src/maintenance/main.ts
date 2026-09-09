import "./maintenance.css";
import {
  mountSkinRunner,
  readPlayerHint,
  type RunnerState,
} from "@/lib/skin-runner";

const POLL_INTERVAL_MS = 15000;
const RELOAD_DELAY_MS = 1500;
const RELOAD_WINDOW_MS = 10 * 60 * 1000;
const MAX_AUTO_RELOADS = 3;
const SELF_PATH = "/maintenance.html";
const HEALTH_PATH = "/api/health";
const RELOAD_KEY = "skin-runner:maintenance-reloads";

const canvas = document.querySelector<HTMLCanvasElement>("#runner");
const deploying = document.querySelector<HTMLElement>("#deploying");
const backOnlineBanner = document.querySelector<HTMLElement>("#back-online");

const player = readPlayerHint();

let state: RunnerState = "loading";
let backOnline = false;
let reloadTimer: number | null = null;

function readReloads(): number {
  try {
    const raw = sessionStorage.getItem(RELOAD_KEY);
    if (!raw) return 0;
    const [count, at] = raw.split(":").map(Number);
    if (!count || !at || Date.now() - at > RELOAD_WINDOW_MS) return 0;
    return count;
  } catch {
    return 0;
  }
}

function recordReload(): void {
  try {
    sessionStorage.setItem(RELOAD_KEY, `${readReloads() + 1}:${Date.now()}`);
  } catch {
    return;
  }
}

function scheduleReload(): void {
  if (reloadTimer !== null) return;
  reloadTimer = window.setTimeout(() => {
    recordReload();
    window.location.reload();
  }, RELOAD_DELAY_MS);
}

function cancelReload(): void {
  if (reloadTimer === null) return;
  window.clearTimeout(reloadTimer);
  reloadTimer = null;
}

function handleState(next: RunnerState): void {
  state = next;
  if (next === "running") {
    cancelReload();
    return;
  }
  if (backOnline) scheduleReload();
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
    const response = await fetch(`${HEALTH_PATH}?probe=${Date.now()}`, {
      cache: "no-store",
    });
    const type = response.headers.get("content-type") ?? "";
    return type.includes("application/json");
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

if (
  window.location.pathname !== SELF_PATH &&
  readReloads() < MAX_AUTO_RELOADS
) {
  window.setTimeout(() => void poll(), POLL_INTERVAL_MS);
}
