import { Q } from "@/db";

export interface PlanningPerson {
  discordId: string;
  minecraftUuid: string | null;
  minecraftUsername: string | null;
}

export type PersonResolver = (discordId: string) => PlanningPerson;

export async function loadPeople(
  discordIds: Iterable<string>,
): Promise<PersonResolver> {
  const unique = [...new Set(discordIds)];
  const players =
    unique.length > 0
      ? await Q.player.findAll({ discordId: { $in: unique } })
      : [];
  const byDiscordId = new Map(players.map((p) => [p.discordId, p]));

  return (discordId) => {
    const player = byDiscordId.get(discordId);
    return {
      discordId,
      minecraftUuid: player?.minecraftUuid ?? null,
      minecraftUsername: player?.minecraftUsername ?? null,
    };
  };
}

export function byName(a: PlanningPerson, b: PlanningPerson): number {
  return (a.minecraftUsername ?? a.discordId).localeCompare(
    b.minecraftUsername ?? b.discordId,
  );
}
