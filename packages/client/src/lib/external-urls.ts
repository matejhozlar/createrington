export const DISCORD_INVITE_URL = "https://discord.gg/mtF6MDHj4Z";
export const CURSEFORGE_MODPACK_URL =
  "https://www.curseforge.com/minecraft/modpacks/createrington-cogs-steam";
export const CONTACT_EMAIL = "admin@createrington.com";

const MC_HEADS_BASE = "https://mc-heads.net";

export function mcHeadsAvatar(uuid: string, size?: number): string {
  return size === undefined
    ? `${MC_HEADS_BASE}/avatar/${uuid}`
    : `${MC_HEADS_BASE}/avatar/${uuid}/${size}`;
}

export function mcHeadsBody(uuid: string): string {
  return `${MC_HEADS_BASE}/body/${uuid}`;
}

export function mcBodyFront(uuid: string): string {
  return `https://api.mineatar.io/body/front/${uuid}?scale=6`;
}
