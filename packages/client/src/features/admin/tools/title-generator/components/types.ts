import type { Catalog } from "../engine/assets";
import type { TitleLayer } from "../engine/types";
import type { LayerUpdate } from "../hooks/use-title-project";

export type LayerTabProps = {
  layer: TitleLayer;
  catalog: Catalog;
  onChange: (update: LayerUpdate) => void;
};
