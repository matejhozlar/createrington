export const DISCORD_INVITE_URL = "https://discord.gg/mtF6MDHj4Z";
export const CURSEFORGE_MODPACK_URL =
  "https://www.curseforge.com/minecraft/modpacks/createrington-rails-n-sails";
export const CONTACT_EMAIL = "admin@createrington.com";
export const SKIN_API_URL = "https://api.createrington.com";
export const SKIN_API_REQUEST_INVITE_URL = `${SKIN_API_URL}/request-invite`;
export const SKIN_API_DOCS_URL = `${SKIN_API_URL}/docs`;

export function mcHeadsSkin(uuid: string): string {
  return `https://mc-heads.net/skin/${encodeURIComponent(uuid)}`;
}
