import { BadRequestError, InternalServerError } from "@/errors";
import { getServerByIp, isValidServerId } from "@/services/playtime/config";
import type { Request } from "express";

export function resolveServerId(
  req: Request,
  bodyServerId: number | null | undefined,
  context: string,
): number {
  const serverIp = req.serverIp;
  if (!serverIp) {
    throw new InternalServerError(
      "Server IP not detected - IP verification middleware may not be properly configured",
    );
  }

  const ipServer = getServerByIp(serverIp);

  if (bodyServerId !== undefined && bodyServerId !== null) {
    if (!isValidServerId(bodyServerId)) {
      logger.warn(
        `${context} rejected: unknown serverId ${bodyServerId} (server IP: ${serverIp})`,
      );
      throw new BadRequestError("Unknown serverId");
    }
    if (ipServer && ipServer.serverId !== bodyServerId) {
      logger.warn(
        `${context} rejected: serverId ${bodyServerId} does not match server ${ipServer.serverId} resolved from IP ${serverIp}`,
      );
      throw new BadRequestError(
        "serverId does not match the originating server",
      );
    }
    return bodyServerId;
  }

  if (!ipServer) {
    logger.warn(`${context} from unknown server IP: ${serverIp}`);
    throw new BadRequestError(
      `Server IP ${serverIp} is not configured. Please contact an administrator`,
    );
  }

  return ipServer.serverId;
}
