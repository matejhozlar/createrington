import {
  createKeyValueStore,
  readStored,
  writeStored,
} from "@/services/key-value-store";
import {
  LAUNCHER_ACCESS_TOKEN_TTL_SECONDS,
  type LauncherJwtPayload,
} from "./launcher-jwt.service";

const KEY_PREFIX = "launcher:denied";
const DENY_TTL_MS = (LAUNCHER_ACCESS_TOKEN_TTL_SECONDS + 60) * 1000;
const MAX_MEMORY_DENIALS = 100_000;

const denials = createKeyValueStore(MAX_MEMORY_DENIALS);

function familyKey(familyId: string): string {
  return `${KEY_PREFIX}:family:${familyId}`;
}

function playerKey(minecraftUuid: string): string {
  return `${KEY_PREFIX}:player:${minecraftUuid}`;
}

function issuedBefore(issuedAtMs: number, deniedAt?: number): boolean {
  return deniedAt !== undefined && issuedAtMs <= deniedAt;
}

/** Refuses every launcher access token issued so far in the session family, for as long as one could still be live. */
export async function denyLauncherFamily(familyId: string): Promise<void> {
  await writeStored(denials, familyKey(familyId), Date.now(), DENY_TTL_MS);
}

/** Refuses every launcher access token issued so far to the player, for as long as one could still be live. */
export async function denyLauncherPlayer(minecraftUuid: string): Promise<void> {
  await writeStored(denials, playerKey(minecraftUuid), Date.now(), DENY_TTL_MS);
}

/** Whether the token was issued before its session family or its player was last denied. */
export async function isLauncherTokenDenied(
  payload: LauncherJwtPayload,
): Promise<boolean> {
  const [familyDeniedAt, playerDeniedAt] = await Promise.all([
    readStored<number>(denials, familyKey(payload.familyId)),
    readStored<number>(denials, playerKey(payload.minecraftUuid)),
  ]);
  const issuedAtMs = payload.issuedAt * 1000;
  return (
    issuedBefore(issuedAtMs, familyDeniedAt) ||
    issuedBefore(issuedAtMs, playerDeniedAt)
  );
}
