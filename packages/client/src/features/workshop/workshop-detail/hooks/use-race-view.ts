import { useMemo } from "react";
import type { RouterOutput } from "@/lib/trpc";
import { projectCategories } from "@/features/workshop/format";
import type { RaceMod } from "@/features/workshop/workshop-detail/components/Leaderboard";

export type SortMode = "top" | "new" | "votes";

type PackRow = RouterOutput["user"]["workshops"]["getPack"]["mods"][number];

interface RaceViewInput {
  mods: RaceMod[] | undefined;
  rejectedMods: RaceMod[] | undefined;
  upvotedModIds: number[] | undefined;
  packRows: PackRow[] | undefined;
  query: string;
  category: string;
  sortMode: SortMode;
}

function byRace(a: RaceMod, b: RaceMod): number {
  return (
    b.upvoteCount - a.upvoteCount ||
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() ||
    a.id - b.id
  );
}

function byNewest(a: RaceMod, b: RaceMod): number {
  return (
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() ||
    b.id - a.id
  );
}

function inCategory(categories: unknown, category: string): boolean {
  return category === "all" || projectCategories(categories).includes(category);
}

export function useRaceView({
  mods,
  rejectedMods,
  upvotedModIds,
  packRows,
  query,
  category,
  sortMode,
}: RaceViewInput) {
  const searching = query.length > 0;

  const race = useMemo(() => {
    const all = mods ?? [];
    const ranked = all.filter((mod) => mod.status === "pending").sort(byRace);
    return {
      ranked,
      rankById: new Map(ranked.map((mod, index) => [mod.id, index + 1])),
      maxRaceCount: Math.max(1, ...ranked.map((mod) => mod.upvoteCount)),
      categories: [
        ...new Set(
          all.flatMap((mod) => projectCategories(mod.project.categories)),
        ),
      ].sort(),
    };
  }, [mods]);

  const upvotedIds = useMemo(
    () => new Set(upvotedModIds ?? []),
    [upvotedModIds],
  );

  const visible = useMemo(() => {
    let result: RaceMod[] = searching
      ? [...(mods ?? []), ...(rejectedMods ?? [])].sort(byRace)
      : race.ranked;
    if (sortMode === "new") result = [...result].sort(byNewest);
    if (sortMode === "votes") {
      result = result.filter((mod) => upvotedIds.has(mod.id));
    }
    result = result.filter((mod) =>
      inCategory(mod.project.categories, category),
    );
    if (searching) {
      result = result.filter((mod) =>
        `${mod.project.name} ${mod.project.primaryAuthor ?? ""} ${mod.submitterName ?? ""}`
          .toLowerCase()
          .includes(query),
      );
    }
    return result;
  }, [
    mods,
    rejectedMods,
    race.ranked,
    searching,
    sortMode,
    upvotedIds,
    category,
    query,
  ]);

  const packMatches = useMemo(() => {
    if (!searching || sortMode === "votes") return [];
    return (packRows ?? []).filter(
      (row) =>
        row.origin !== "suggestion" &&
        `${row.project.name} ${row.project.primaryAuthor ?? ""}`
          .toLowerCase()
          .includes(query) &&
        inCategory(row.project.categories, category),
    );
  }, [packRows, searching, sortMode, category, query]);

  return {
    rankById: race.rankById,
    maxRaceCount: race.maxRaceCount,
    categories: race.categories,
    upvotedIds,
    visible,
    packMatches,
  };
}
