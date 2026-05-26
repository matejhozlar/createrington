import type { Express, Request, Response } from "express";
import { Status } from "discord.js";
import { container, Services, getServiceSync } from "@/services";
import pool from "@/db";

type ComponentStatus = "up" | "down" | "degraded";

interface ComponentBase {
  status: ComponentStatus;
}

interface DatabaseComponent extends ComponentBase {
  latencyMs?: number;
  error?: string;
}

interface DiscordBotComponent extends ComponentBase {
  pingMs?: number;
  wsState?: string;
}

interface WebsocketComponent extends ComponentBase {
  connectedClients?: number;
  uptimeSeconds?: number;
}

interface PlaytimeServerInfo {
  initialized: boolean;
  activeSessions: number;
  state: string;
}

interface PlaytimeComponent extends ComponentBase {
  servers?: Record<string, PlaytimeServerInfo>;
}

interface HealthResponse {
  status: "healthy" | "degraded" | "down";
  timestamp: string;
  version: string;
  commit?: string;
  uptimeSeconds: number;
  components: {
    database: DatabaseComponent;
    mainBot: DiscordBotComponent;
    webBot: DiscordBotComponent;
    websocket: WebsocketComponent;
    playtime: PlaytimeComponent;
  };
}

const VERSION =
  process.env.APP_VERSION ?? process.env.npm_package_version ?? "unknown";
const COMMIT = process.env.GIT_COMMIT;

const CRITICAL_COMPONENTS = ["database", "mainBot"] as const;

async function checkDatabase(): Promise<DatabaseComponent> {
  const start = Date.now();
  try {
    await pool.query("SELECT 1");
    return { status: "up", latencyMs: Date.now() - start };
  } catch (err) {
    return {
      status: "down",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function checkDiscordBot(
  serviceKey:
    | typeof Services.DISCORD_MAIN_BOT
    | typeof Services.DISCORD_WEB_BOT,
): DiscordBotComponent {
  try {
    const bot = getServiceSync(serviceKey);
    const wsStatus = bot.ws.status;
    const wsState = Status[wsStatus];
    const status: ComponentStatus =
      wsStatus === Status.Ready
        ? "up"
        : wsStatus === Status.Disconnected
          ? "down"
          : "degraded";
    return { status, pingMs: bot.ws.ping, wsState };
  } catch {
    return { status: "down" };
  }
}

async function checkWebsocket(): Promise<WebsocketComponent> {
  try {
    const ws = getServiceSync(Services.WEBSOCKET_SERVICE);
    const stats = await ws.getStats();
    return {
      status: "up",
      connectedClients: stats.connectedClients,
      uptimeSeconds: stats.uptime,
    };
  } catch {
    return { status: "down" };
  }
}

function checkPlaytime(): PlaytimeComponent {
  try {
    const pm = getServiceSync(Services.PLAYTIME_MANAGER_SERVICE);
    const raw = pm.getStatus();
    const servers: Record<string, PlaytimeServerInfo> = {};
    let anyDegraded = false;
    for (const [serverId, info] of Object.entries(raw)) {
      servers[serverId] = {
        initialized: info.isInitialized,
        activeSessions: info.activeSessions,
        state: info.serverState,
      };
      if (!info.isInitialized) anyDegraded = true;
    }
    return { status: anyDegraded ? "degraded" : "up", servers };
  } catch {
    return { status: "down" };
  }
}

function rollupStatus(
  components: HealthResponse["components"],
): HealthResponse["status"] {
  const containerStates = container.getAllStates();
  const anyFailed = Object.values(containerStates).some((s) => s === "failed");
  const allReady = Object.values(containerStates).every((s) => s === "ready");

  const criticalDown = CRITICAL_COMPONENTS.some(
    (key) => components[key].status === "down",
  );
  if (criticalDown || anyFailed) return "down";

  const anyDegraded = Object.values(components).some(
    (c) => c.status === "degraded" || c.status === "down",
  );
  if (anyDegraded || !allReady) return "degraded";

  return "healthy";
}

async function buildHealthSnapshot(): Promise<HealthResponse> {
  const [database, websocket] = await Promise.all([
    checkDatabase(),
    checkWebsocket(),
  ]);
  const components = {
    database,
    mainBot: checkDiscordBot(Services.DISCORD_MAIN_BOT),
    webBot: checkDiscordBot(Services.DISCORD_WEB_BOT),
    websocket,
    playtime: checkPlaytime(),
  } satisfies HealthResponse["components"];

  return {
    status: rollupStatus(components),
    timestamp: new Date().toISOString(),
    version: VERSION,
    ...(COMMIT ? { commit: COMMIT } : {}),
    uptimeSeconds: process.uptime(),
    components,
  };
}

async function healthHandler(_req: Request, res: Response): Promise<void> {
  const snapshot = await buildHealthSnapshot();
  res.setHeader("Cache-Control", "no-store");
  res.json(snapshot);
}

export function registerHealthRoute(app: Express): void {
  app.get("/api/health", healthHandler);
}
