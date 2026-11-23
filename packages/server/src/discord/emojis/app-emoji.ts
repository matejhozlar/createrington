import { getServiceIfReady, Services } from "@/services";
import { APP_EMOJIS, type AppEmojiKey } from "./manifest";

export function appEmoji(key: AppEmojiKey): string {
  const service = getServiceIfReady(Services.APP_EMOJI_SERVICE);
  return service ? service.token(key) : APP_EMOJIS[key].fallback;
}
