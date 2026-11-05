import config from "@/config";

const MC_HEADS_URL = "https://mc-heads.net";
const MC_HEADS_BODY_SIZE = 600;

export function playerAvatarUrl(minecraftUuid: string): string {
  return new URL(
    `/api/skin/${minecraftUuid}/avatar`,
    config.meta.links.website,
  ).toString();
}

export function mcHeadsAvatarUrl(minecraftUuid: string, size: number): string {
  return `${MC_HEADS_URL}/avatar/${minecraftUuid}/${size}`;
}

export function mcHeadsBodyUrl(minecraftUuid: string): string {
  return `${MC_HEADS_URL}/body/${minecraftUuid}/${MC_HEADS_BODY_SIZE}`;
}
