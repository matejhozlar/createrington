import { useEffect, useState } from "react";
import {
  PodiumCard,
  PodiumStatus,
  type PodiumPlayer,
} from "./components/PodiumCard";
import { usePodiumSkins } from "./hooks/use-podium-skins";

interface RecordsData {
  contestedKeys: number;
  players: PodiumPlayer[];
}

const BANNER = {
  src: "/assets/render/player-records.webp",
  alt: "Player Records",
};
const TITLE = "Most #1 Placements";

function formatValue(value: number): string {
  return `${value.toLocaleString()} ${value === 1 ? "record" : "records"}`;
}

export function RecordsRender() {
  const [data, setData] = useState<RecordsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const skins = usePodiumSkins(data?.players ?? null);

  useEffect(() => {
    fetch(new URL("/api/render/records", window.location.origin).toString())
      .then((res) => {
        if (!res.ok) throw new Error("Bad response");
        return res.json() as Promise<RecordsData>;
      })
      .then(setData)
      .catch(() => setError("Failed to load record data"));
  }, []);

  if (error) return <PodiumStatus message={error} tone="error" />;
  if (!data || !skins)
    return <PodiumStatus message="Loading..." tone="muted" />;

  return (
    <PodiumCard
      containerId="records-container"
      banner={BANNER}
      title={TITLE}
      subtitle={`Across ${data.contestedKeys.toLocaleString()} contested stats`}
      players={data.players}
      skins={skins}
      emptyText="No contested stats yet"
      formatValue={formatValue}
    />
  );
}
