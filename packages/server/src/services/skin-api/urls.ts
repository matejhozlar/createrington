import { siteUrl } from "@/config/site-url";

const MC_HEADS_URL = "https://mc-heads.net";
const MC_HEADS_BODY_SIZE = 600;

export function playerAvatarUrl(minecraftUuid: string): string {
  return siteUrl(`/api/skin/${minecraftUuid}/avatar`);
}

export function mcHeadsAvatarUrl(minecraftUuid: string, size: number): string {
  return `${MC_HEADS_URL}/avatar/${minecraftUuid}/${size}`;
}

export function mcHeadsBodyUrl(minecraftUuid: string): string {
  return `${MC_HEADS_URL}/body/${minecraftUuid}/${MC_HEADS_BODY_SIZE}`;
}
