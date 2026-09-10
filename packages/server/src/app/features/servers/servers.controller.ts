import { BadRequestError, NotFoundError } from "@/app/middleware";
import { getService, Services } from "@/services";
import { MINECRAFT_SERVERS } from "@/services/playtime/config";
import {
  buildServerStatusSummary,
  type ServerStatusSummary,
} from "@/services/playtime/server-status";
import type { PlaytimeManagerService } from "@/services/playtime";
import type { Request, Response } from "express";

const SERVER_SLUG_RE = /^[a-z0-9-]{1,32}$/;
const CACHE_CONTROL = "public, max-age=10";

export interface ServerStatusEntry {
  id: number;
  slug: string;
  name: string;
  status: ServerStatusSummary["status"];
  maintenance: boolean;
  playerCount: number;
  maxPlayers: number;
}

export interface ServerStatusResponse {
  servers: ServerStatusEntry[];
  totalPlayers: number;
  generatedAt: string;
}

function parseServerSlug(value: unknown): string | undefined {
  if (value === undefined || value === "") {
    return undefined;
  }

  if (typeof value !== "string" || !SERVER_SLUG_RE.test(value)) {
    throw new BadRequestError("server must be a valid server slug");
  }

  return value;
}

async function getPlaytimeManager(): Promise<
  PlaytimeManagerService | undefined
> {
  try {
    return await getService(Services.PLAYTIME_MANAGER_SERVICE);
  } catch (error) {
    logger.debug("Playtime manager unavailable, reporting unknown status", {
      error,
    });
    return undefined;
  }
}

export class ServersController {
  /**
   * GET /api/servers/status
   *
   * Current status and player counts of every configured server. `?server=<slug>` narrows the list to one server (404 when the slug is unknown; an empty value is ignored).
   *
   * Response is a flat JSON body, not enveloped:
   * `{ servers: [{ id, slug, name, status: "online" | "offline" | "unknown", maintenance, playerCount, maxPlayers }], totalPlayers, generatedAt }`
   * Errors use the standard `{ success: false, message, error }` envelope.
   *
   * `status` mirrors the tracked server state (relay messages, heartbeats, join events). `playerCount` is the number of tracked sessions and may lag `status` by a few seconds during a transition. `generatedAt` is the response time, not a poll time. Cacheable for 10 seconds.
   */
  static async getStatus(req: Request, res: Response): Promise<void> {
    const slug = parseServerSlug(req.query.server);

    const configs = Object.values(MINECRAFT_SERVERS)
      .filter((server) => !slug || server.slug === slug)
      .sort((a, b) => a.id - b.id);

    if (slug && configs.length === 0) {
      throw new NotFoundError(`Server "${slug}" not found`);
    }

    const manager = await getPlaytimeManager();

    const servers: ServerStatusEntry[] = configs.map((serverConfig) => {
      const summary = buildServerStatusSummary(
        serverConfig.id,
        serverConfig,
        manager?.getService(serverConfig.id),
      );

      return {
        id: summary.serverId,
        slug: summary.serverSlug,
        name: summary.serverName,
        status: summary.status,
        maintenance: summary.maintenance,
        playerCount: summary.playerCount,
        maxPlayers: summary.maxPlayers,
      };
    });

    const body: ServerStatusResponse = {
      servers,
      totalPlayers: servers.reduce(
        (sum, server) => sum + server.playerCount,
        0,
      ),
      generatedAt: new Date().toISOString(),
    };

    res.setHeader("Cache-Control", CACHE_CONTROL);
    res.json(body);
  }
}
