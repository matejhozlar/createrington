import config from "@/config";
import { NotFoundError } from "@/errors";

export interface McServer {
  id: number;
  name: string;
  slug: string;
  ip: string;
  port: number;
  maxPlayers: number;
  rcon: {
    host: string;
    port: number;
    password: string;
  };
  sftp: {
    host: string;
    port: number;
    username: string;
    password: string;
    statsPath: string;
  };
}

const { rails } = config.servers;

export const SERVERS: readonly McServer[] = [
  {
    id: rails.id,
    name: rails.name,
    slug: rails.slug,
    ip: rails.ip,
    port: rails.port,
    maxPlayers: 20,
    rcon: rails.rcon,
    sftp: rails.sftp,
  },
];

export const SERVER_IDS: readonly number[] = SERVERS.map((server) => server.id);

export function getServerById(id: number): McServer | undefined {
  return SERVERS.find((server) => server.id === id);
}

export function requireServer(id: number): McServer {
  const server = getServerById(id);
  if (!server) {
    throw new NotFoundError(`Server with id ${id} not found`);
  }
  return server;
}

export function getServerByIp(ip: string): McServer | undefined {
  return SERVERS.find((server) => server.ip === ip);
}

export function isValidServerId(id: number): boolean {
  return SERVERS.some((server) => server.id === id);
}
