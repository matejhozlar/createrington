import { MinecraftRconManager } from "./manager";

export type RconSend = (serverId: number, command: string) => Promise<string>;

export const MINECRAFT_USERNAME = /^[A-Za-z0-9_]{1,16}$/;

const FORMATTING_CODE = /§[0-9a-fk-orx]/gi;
const UNKNOWN_COMMAND =
  /unknown or incomplete command|unknown command|incorrect argument/i;

export function stripFormatting(text: string): string {
  return text.replace(FORMATTING_CODE, "").trim();
}

export function isUnknownCommand(response: string): boolean {
  return UNKNOWN_COMMAND.test(response);
}

export function requireUsername(username: string): string {
  const name = username.trim();
  if (!MINECRAFT_USERNAME.test(name)) {
    throw new Error(`Invalid Minecraft username: ${JSON.stringify(username)}`);
  }
  return name;
}

export const defaultRconSend: RconSend = (serverId, command) =>
  MinecraftRconManager.getInstance().send(serverId, command);
