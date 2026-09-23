import { getServiceSync, isServiceReady, Services } from "@/services";
import { APP_EMOJIS, type AppEmojiKey } from "./manifest";

export function appEmoji(key: AppEmojiKey): string {
  if (!isServiceReady(Services.APP_EMOJI_SERVICE)) {
    return APP_EMOJIS[key].fallback;
  }
  return getServiceSync(Services.APP_EMOJI_SERVICE).token(key);
}
