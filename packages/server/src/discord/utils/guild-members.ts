import { GatewayRateLimitError, type Guild } from "discord.js";

const FULL_FETCH_WINDOW_MS = 30_000;

interface FullFetchState {
  completedAt: number | null;
  inFlight: Promise<void> | null;
}

const fullFetches = new Map<string, FullFetchState>();

function stateFor(guildId: string): FullFetchState {
  let state = fullFetches.get(guildId);
  if (!state) {
    state = { completedAt: null, inFlight: null };
    fullFetches.set(guildId, state);
  }
  return state;
}

async function fetchWithRetry(guild: Guild): Promise<void> {
  try {
    await guild.members.fetch();
  } catch (error) {
    if (!(error instanceof GatewayRateLimitError)) throw error;

    const waitMs = Math.ceil(error.data.retry_after * 1000);
    logger.warn(
      `Full member fetch for guild ${guild.id} was rate limited, retrying in ${waitMs}ms`,
    );
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    await guild.members.fetch();
  }
}

export async function loadAllGuildMembers(guild: Guild): Promise<Guild> {
  const state = stateFor(guild.id);

  if (
    state.completedAt !== null &&
    Date.now() - state.completedAt < FULL_FETCH_WINDOW_MS
  ) {
    return guild;
  }

  if (!state.inFlight) {
    state.inFlight = fetchWithRetry(guild)
      .then(() => {
        state.completedAt = Date.now();
      })
      .finally(() => {
        state.inFlight = null;
      });
  }

  await state.inFlight;
  return guild;
}

export function resetGuildMemberFetchCache(): void {
  fullFetches.clear();
}
