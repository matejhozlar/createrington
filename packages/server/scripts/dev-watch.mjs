import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import chokidar from "chokidar";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, "..");
const entry = path.join(serverRoot, "src", "server.ts");
const watchRoot = path.join(serverRoot, "src");

const RESTART_DEBOUNCE_MS = 150;

let child = null;
let restartTimer = null;
let restarting = false;
let shuttingDown = false;

function spawnServer() {
  restarting = false;
  child = spawn(
    process.execPath,
    ["--import", "tsx/esm", entry],
    { stdio: "inherit", cwd: serverRoot },
  );

  child.on("exit", (code, signal) => {
    child = null;
    if (shuttingDown) return;
    if (restarting) return;
    if (signal) return;
    if (code !== 0) {
      console.log(`\n[dev-watch] server exited with code ${code}. waiting for changes...`);
    }
  });
}

function scheduleRestart(reason) {
  if (restartTimer) clearTimeout(restartTimer);
  restartTimer = setTimeout(() => {
    restartTimer = null;
    restarting = true;
    console.log(`\n[dev-watch] restarting (${reason})`);
    if (child && child.exitCode === null) {
      child.once("exit", spawnServer);
      child.kill("SIGTERM");
      setTimeout(() => {
        if (child && child.exitCode === null) child.kill("SIGKILL");
      }, 2000);
    } else {
      spawnServer();
    }
  }, RESTART_DEBOUNCE_MS);
}

const watcher = chokidar.watch(watchRoot, {
  ignoreInitial: true,
  ignored: [
    /(^|[\/\\])\../,
    "**/node_modules/**",
    "**/dist/**",
    "**/logs/**",
    "**/generated/**",
  ],
  awaitWriteFinish: {
    stabilityThreshold: 100,
    pollInterval: 50,
  },
});

watcher.on("ready", () => {
  console.log(`[dev-watch] watching ${path.relative(serverRoot, watchRoot) || "src"} (chokidar)`);
  spawnServer();
});

for (const event of ["add", "change", "unlink"]) {
  watcher.on(event, (file) => {
    scheduleRestart(`${event}: ${path.relative(serverRoot, file)}`);
  });
}

function shutdown() {
  shuttingDown = true;
  watcher.close();
  if (child && child.exitCode === null) child.kill("SIGTERM");
}

process.on("SIGINT", () => {
  shutdown();
  process.exit(0);
});
process.on("SIGTERM", () => {
  shutdown();
  process.exit(0);
});
