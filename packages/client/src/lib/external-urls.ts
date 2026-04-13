export const DISCORD_INVITE_URL = "https://discord.gg/mtF6MDHj4Z";
export const CURSEFORGE_MODPACK_URL =
  "https://www.curseforge.com/minecraft/modpacks/createrington-cogs-steam";
export const CONTACT_EMAIL = "admin@create-rington.com";

const MC_HEADS_BASE = "https://mc-heads.net";

export function mcHeadsAvatar(uuid: string): string {
  return `${MC_HEADS_BASE}/avatar/${uuid}`;
}

export function mcHeadsBody(uuid: string): string {
  return `${MC_HEADS_BASE}/body/${uuid}`;
}

export function mcBodyFront(uuid: string): string {
  return `https://api.mineatar.io/body/front/${uuid}?scale=6`;
}
