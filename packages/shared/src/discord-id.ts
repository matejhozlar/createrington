export const DISCORD_ID_REGEX = /^\d{17,20}$/;

export function isDiscordId(value: string): boolean {
  return DISCORD_ID_REGEX.test(value);
}
