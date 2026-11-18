import { Discord } from "@/discord/constants";

export interface ServerConfig {
  id: number;
  label: string;
  description: string;
  roleId: string;
  emoji: string;
  enabled: boolean;
}

export const SERVER_CONFIGS: ServerConfig[] = [
  {
    id: 99,
    label: "Tester",
    description: "Get access to the public testing forum",
    roleId: Discord.Roles.TESTER,
    emoji: "🧪",
    enabled: true,
  },
];

export function getEnabledServers(): ServerConfig[] {
  return SERVER_CONFIGS.filter((server) => server.enabled);
}

export function getServerConfig(serverId: number): ServerConfig | undefined {
  return SERVER_CONFIGS.find((server) => server.id === serverId);
}
