export const CUSTOM_EMOJI_PATTERN = /^<(a?):([a-zA-Z0-9_]{2,32}):(\d+)>$/;

export function customEmojiUrl(id: string, animated: boolean): string {
  const extension = animated ? "gif" : "webp";
  return `https://cdn.discordapp.com/emojis/${id}.${extension}?size=44&quality=lossless`;
}
