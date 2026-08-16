export const DISCORD_INVITE_URL = "https://discord.gg/mtF6MDHj4Z";
export const CURSEFORGE_MODPACK_URL =
  "https://www.curseforge.com/minecraft/modpacks/createrington-cogs-steam";
export const CONTACT_EMAIL = "admin@createrington.com";

const MC_HEADS_BASE = "https://mc-heads.net";
// mc-heads clamps /body here (600 and 1200 both return 600x1441). Its
// unsized default is only 180x432, which the skin renders display upscaled.
const MC_HEADS_BODY_MAX = 600;

export function mcHeadsAvatar(uuid: string, size?: number): string {
  const id = encodeURIComponent(uuid);
  return size === undefined
    ? `${MC_HEADS_BASE}/avatar/${id}`
    : `${MC_HEADS_BASE}/avatar/${id}/${size}`;
}

export function mcHeadsBody(uuid: string, size = MC_HEADS_BODY_MAX): string {
  return `${MC_HEADS_BASE}/body/${encodeURIComponent(uuid)}/${size}`;
}

export function mcBodyFront(uuid: string): string {
  return `https://api.mineatar.io/body/front/${uuid}?scale=6`;
}
