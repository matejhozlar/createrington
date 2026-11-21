import { getValidated } from "@/app/middleware/validation.middleware";
import { NotFoundError } from "@/errors";
import { getService, Services } from "@/services";
import { SERVERS } from "@/services/mc-server/servers";
import {
  buildServerStatusSummary,
  type ServerStatusSummary,
} from "@/services/playtime/server-status";
import type { PlaytimeManagerService } from "@/services/playtime";
import type { Request, Response } from "express";
import type { ServerStatusQuery } from "./servers.schemas";

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
  static async getStatus(_req: Request, res: Response): Promise<void> {
    const {
      query: { server: slug },
    } = getValidated<{ query: ServerStatusQuery }>(res);

    const configs = SERVERS.filter(
      (server) => !slug || server.slug === slug,
    ).sort((a, b) => a.id - b.id);

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
