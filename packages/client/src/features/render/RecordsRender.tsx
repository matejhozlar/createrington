import { LoadingScreen } from "@/components/query-states";
import { PodiumCard } from "./components/PodiumCard";
import { RenderUnavailable } from "./components/RenderUnavailable";
import { usePodiumSkins } from "./hooks/use-podium-skins";
import { useRenderData } from "./hooks/use-render-data";
import { useRenderPlatesReady } from "./hooks/use-render-plates";
import { pluralize } from "@/lib/format";

const BANNER = {
  src: "/assets/render/player-records.webp",
  alt: "Player Records",
};
const TITLE = "Most #1 Placements";

function formatValue(value: number): string {
  return pluralize(value, "record");
}

export function RecordsRender() {
  const { data, unavailable } = useRenderData("records");
  const skins = usePodiumSkins(data?.players ?? null);
  const platesReady = useRenderPlatesReady();

  if (unavailable) return <RenderUnavailable reason={unavailable} />;
  if (!data || !skins || !platesReady) return <LoadingScreen />;

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
