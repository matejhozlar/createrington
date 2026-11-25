import {
  MemoryKeyValueStore,
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

const shared = createKeyValueStore(MAX_MEMORY_DENIALS);
const local = new MemoryKeyValueStore(MAX_MEMORY_DENIALS);

function familyKey(familyId: string): string {
  return `${KEY_PREFIX}:family:${familyId}`;
}

function playerKey(minecraftUuid: string): string {
  return `${KEY_PREFIX}:player:${minecraftUuid}`;
}

function issuedBefore(issuedAtMs: number, deniedAt?: number): boolean {
  return deniedAt !== undefined && issuedAtMs <= deniedAt;
}

async function deny(key: string): Promise<void> {
  const deniedAt = Date.now();
  await Promise.all([
    writeStored(shared, key, deniedAt, DENY_TTL_MS),
    writeStored(local, key, deniedAt, DENY_TTL_MS),
  ]);
}

async function lastDeniedAt(key: string): Promise<number | undefined> {
  const found = (
    await Promise.all([
      readStored<number>(shared, key),
      readStored<number>(local, key),
    ])
  ).filter((deniedAt) => deniedAt !== undefined);
  return found.length > 0 ? Math.max(...found) : undefined;
}

/** Refuses every launcher access token issued so far in the session family, for as long as one could still be live. */
export async function denyLauncherFamily(familyId: string): Promise<void> {
  await deny(familyKey(familyId));
}

/** Refuses every launcher access token issued so far to the player, for as long as one could still be live. */
export async function denyLauncherPlayer(minecraftUuid: string): Promise<void> {
  await deny(playerKey(minecraftUuid));
}

/**
 * Whether the token was issued before its session family or its player was
 * last denied. A denial is written to Redis and to this process's memory and
 * read from both, so one made while Redis was unreachable still holds once it
 * is back, and one made while it was up still holds while it is unreachable.
 */
export async function isLauncherTokenDenied(
  payload: LauncherJwtPayload,
): Promise<boolean> {
  const [familyDeniedAt, playerDeniedAt] = await Promise.all([
    lastDeniedAt(familyKey(payload.familyId)),
    lastDeniedAt(playerKey(payload.minecraftUuid)),
  ]);
  const issuedAtMs = payload.issuedAt * 1000;
  return (
    issuedBefore(issuedAtMs, familyDeniedAt) ||
    issuedBefore(issuedAtMs, playerDeniedAt)
  );
}
