import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import {
  PodiumCard,
  PodiumStatus,
  type PodiumPlayer,
} from "./components/PodiumCard";
import { usePodiumSkins } from "./hooks/use-podium-skins";

interface TopData {
  category: string;
  item: string;
  displayTitle: string;
  players: PodiumPlayer[];
}

const BANNER = { src: "/assets/render/player-top.webp", alt: "Top Players" };

function formatValue(value: number): string {
  return value.toLocaleString();
}

export function TopRender() {
  const [params] = useSearchParams();
  const [data, setData] = useState<TopData | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const skins = usePodiumSkins(data?.players ?? null);

  const category = params.get("category");
  const item = params.get("item");
  const hasMissingParams = !category || !item;

  useEffect(() => {
    if (hasMissingParams) return;

    const url = new URL("/api/render/top", window.location.origin);
    url.searchParams.set("category", category);
    url.searchParams.set("item", item);

    fetch(url.toString())
      .then((res) => {
        if (!res.ok) throw new Error("Bad response");
        return res.json() as Promise<TopData>;
      })
      .then(setData)
      .catch(() => setFetchError("Failed to load leaderboard data"));
  }, [hasMissingParams, category, item]);

  const error = hasMissingParams ? "Missing parameters" : fetchError;

  if (error) return <PodiumStatus message={error} tone="error" />;
  if (!data || !skins)
    return <PodiumStatus message="Loading..." tone="muted" />;

  return (
    <PodiumCard
      containerId="top-container"
      banner={BANNER}
      title={data.displayTitle}
      players={data.players}
      skins={skins}
      emptyText="No players found for this stat"
      formatValue={formatValue}
    />
  );
}
