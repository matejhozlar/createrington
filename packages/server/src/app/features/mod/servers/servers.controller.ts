import { BadRequestError, NotFoundError } from "@/app/middleware";
import { getService, Services } from "@/services";
import { MINECRAFT_SERVERS } from "@/services/playtime/config";
import { buildServerStatus } from "@/services/playtime/server-status";
import type { Request, Response } from "express";

const SERVER_SLUG_RE = /^[a-z0-9-]{1,32}$/;
const CACHE_CONTROL = "public, max-age=10";

export interface ServerStatusEntry {
  id: number;
  slug: string;
  name: string;
  status: "online" | "offline" | "unknown";
  maintenance: boolean;
  playerCount: number;
  maxPlayers: number;
}

export interface ServerStatusResponse {
  servers: ServerStatusEntry[];
  totalPlayers: number;
  checkedAt: string;
}

function parseServerSlug(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || !SERVER_SLUG_RE.test(value)) {
    throw new BadRequestError("server must be a valid server slug");
  }

  return value;
}

export class ServersController {
  static async getStatus(req: Request, res: Response): Promise<void> {
    const slug = parseServerSlug(req.query.server);

    const configs = Object.values(MINECRAFT_SERVERS)
      .filter((server) => !slug || server.slug === slug)
      .sort((a, b) => a.id - b.id);

    if (slug && configs.length === 0) {
      throw new NotFoundError(`Server "${slug}" not found`);
    }

    const manager = await getService(Services.PLAYTIME_MANAGER_SERVICE);

    const servers: ServerStatusEntry[] = configs.map((serverConfig) => {
      const status = buildServerStatus(
        serverConfig.id,
        serverConfig,
        manager.getService(serverConfig.id),
      );

      return {
        id: status.serverId,
        slug: status.serverSlug,
        name: status.serverName,
        status: status.status,
        maintenance: status.maintenance,
        playerCount: status.playerCount,
        maxPlayers: status.maxPlayers,
      };
    });

    const body: ServerStatusResponse = {
      servers,
      totalPlayers: servers.reduce(
        (sum, server) => sum + server.playerCount,
        0,
      ),
      checkedAt: new Date().toISOString(),
    };

    res.setHeader("Cache-Control", CACHE_CONTROL);
    res.json(body);
  }
}
