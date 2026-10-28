const MOJANG_HAS_JOINED_URL =
  "https://sessionserver.mojang.com/session/minecraft/hasJoined";
const REQUEST_TIMEOUT_MS = 5000;

export interface MojangJoinedProfile {
  uuid: string;
  username: string;
}

function dashUuid(undashed: string): string {
  return [
    undashed.slice(0, 8),
    undashed.slice(8, 12),
    undashed.slice(12, 16),
    undashed.slice(16, 20),
    undashed.slice(20),
  ].join("-");
}

export async function verifyMojangJoin(
  username: string,
  serverId: string,
): Promise<MojangJoinedProfile | null> {
  const url = new URL(MOJANG_HAS_JOINED_URL);
  url.searchParams.set("username", username);
  url.searchParams.set("serverId", serverId);

  const res = await fetch(url, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (res.status === 204) return null;
  if (res.status !== 200) {
    throw new Error(`Mojang hasJoined lookup failed (${res.status})`);
  }

  const body = (await res.json()) as { id?: unknown; name?: unknown };
  if (
    typeof body.id !== "string" ||
    typeof body.name !== "string" ||
    !/^[0-9a-fA-F]{32}$/.test(body.id)
  ) {
    return null;
  }

  return { uuid: dashUuid(body.id.toLowerCase()), username: body.name };
}
