import { LoadingScreen } from "@/components/loading-spinner";
import { PodiumCard, type PodiumPlayer } from "./components/PodiumCard";
import { RenderNotFound } from "./components/RenderNotFound";
import { usePodiumSkins } from "./hooks/use-podium-skins";
import { useRenderData } from "./hooks/use-render-data";

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
  const { data, unavailable } = useRenderData<TopData>("top", [
    "category",
    "item",
  ]);
  const skins = usePodiumSkins(data?.players ?? null);

  if (unavailable) return <RenderNotFound />;
  if (!data || !skins) return <LoadingScreen />;

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
