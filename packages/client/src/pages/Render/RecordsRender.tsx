import { LoadingScreen } from "@/components/loading-spinner";
import { PodiumCard, type PodiumPlayer } from "./components/PodiumCard";
import { RenderUnavailable } from "./components/RenderUnavailable";
import { usePodiumSkins } from "./hooks/use-podium-skins";
import { useRenderData } from "./hooks/use-render-data";

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
  const { data, unavailable } = useRenderData<RecordsData>("records");
  const skins = usePodiumSkins(data?.players ?? null);

  if (unavailable) return <RenderUnavailable reason={unavailable} />;
  if (!data || !skins) return <LoadingScreen />;

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
