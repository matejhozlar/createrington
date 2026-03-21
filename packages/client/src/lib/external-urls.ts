export const DISCORD_INVITE_URL = "https://discord.gg/mtF6MDHj4Z";

const MC_HEADS_BASE = "https://mc-heads.net";

export function mcHeadsAvatar(uuid: string): string {
  return `${MC_HEADS_BASE}/avatar/${uuid}`;
}

export function mcHeadsBody(uuid: string): string {
  return `${MC_HEADS_BASE}/body/${uuid}`;
}
