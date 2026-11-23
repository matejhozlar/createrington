import { LoadingScreen } from "@/components/query-states";
import { PLATE_STRIP_HEIGHT } from "@/features/team-tag/plate";
import { RenderTeamTag } from "./components/RenderTeamTag";
import { RenderUnavailable } from "./components/RenderUnavailable";
import { useRenderData } from "./hooks/use-render-data";
import { useRenderPlatesReady } from "./hooks/use-render-plates";

const PLATE_ZOOM = 12;

export function TagRender() {
  const { data, unavailable } = useRenderData("tag", ["design"]);
  const platesReady = useRenderPlatesReady();

  if (unavailable) return <RenderUnavailable reason={unavailable} />;
  if (!data || !platesReady) return <LoadingScreen />;

  return (
    <div id="tag-container" className="size-fit">
      <RenderTeamTag
        code={data.tagCode}
        height={PLATE_STRIP_HEIGHT * PLATE_ZOOM}
      />
    </div>
  );
}
