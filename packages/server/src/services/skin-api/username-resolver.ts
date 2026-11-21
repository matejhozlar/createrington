import { SkinApiError } from "createrington-skin-api";
import { createKeyValueStore, readThrough } from "@/services/key-value-store";
import { getSkinApiClient } from "./client";

const KEY_PREFIX = "skin-api:username:v1";
const HIT_TTL_MS = 24 * 60 * 60 * 1000;
const MISS_TTL_MS = 60 * 60 * 1000;
const MAX_MEMORY_ENTRIES = 1000;

const usernames = createKeyValueStore(MAX_MEMORY_ENTRIES);

async function fetchUsername(uuid: string): Promise<string | null> {
  try {
    return (await getSkinApiClient().resolve({ uuid })).username;
  } catch (error) {
    if (error instanceof SkinApiError && error.status === 404) return null;
    throw error;
  }
}

export function resolveUsername(minecraftUuid: string): Promise<string | null> {
  const uuid = minecraftUuid.toLowerCase();
  return readThrough<string | null>(
    usernames,
    `${KEY_PREFIX}:${uuid}`,
    (username) => (username === null ? MISS_TTL_MS : HIT_TTL_MS),
    () => fetchUsername(uuid),
  );
}
