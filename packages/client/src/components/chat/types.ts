import type { CachedMessage } from "@createrington/shared/socket";
import { MessageSource } from "@createrington/shared/socket";

export interface MessageGroup {
  key: string;
  displayName: string;
  avatarUrl?: string;
  source: MessageSource;
  messages: CachedMessage[];
}
