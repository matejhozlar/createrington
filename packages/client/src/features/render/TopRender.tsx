import { formatStatValue } from "@createrington/shared/minecraft-stats";
import { LoadingScreen } from "@/components/query-states";
import { PodiumCard } from "./components/PodiumCard";
import { RenderUnavailable } from "./components/RenderUnavailable";
import { usePodiumSkins } from "./hooks/use-podium-skins";
import { useRenderData } from "./hooks/use-render-data";
import { useRenderPlatesReady } from "./hooks/use-render-plates";

const BANNER = { src: "/assets/render/player-top.webp", alt: "Top Players" };

export function TopRender() {
  const { data, unavailable } = useRenderData("top", ["category", "item"]);
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
