import { formatStatValue } from "@createrington/shared/minecraft-stats";
import { LoadingScreen } from "@/components/loading-spinner";
import { PodiumCard, type PodiumPlayer } from "./components/PodiumCard";
import { RenderUnavailable } from "./components/RenderUnavailable";
import { usePodiumSkins } from "./hooks/use-podium-skins";
import { useRenderData } from "./hooks/use-render-data";
import { useRenderPlatesReady } from "./hooks/use-render-plates";

interface TopData {
  category: string;
  item: string;
  displayTitle: string;
  players: PodiumPlayer[];
}

const BANNER = { src: "/assets/render/player-top.webp", alt: "Top Players" };

export function TopRender() {
  const { data, unavailable } = useRenderData<TopData>("top", [
    "category",
    "item",
  ]);
  const skins = usePodiumSkins(data?.players ?? null);
  const platesReady = useRenderPlatesReady();

  if (unavailable) return <RenderUnavailable reason={unavailable} />;
  if (!data || !skins || !platesReady) return <LoadingScreen />;

  return (
    <PodiumCard
      containerId="top-container"
      banner={BANNER}
      title={data.displayTitle}
      players={data.players}
      skins={skins}
      emptyText="No players found for this stat"
      formatValue={(value) => formatStatValue(data.category, data.item, value)}
    />
  );
}
