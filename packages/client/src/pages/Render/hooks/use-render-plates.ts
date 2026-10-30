import { usePlateAssets } from "@/features/team-tag/hooks/use-plate-assets";
import type { PlateAssets } from "@/features/team-tag/render/assets";

export function useRenderPlates(): {
  assets: PlateAssets | null;
  pending: boolean;
} {
  const { assets, failed } = usePlateAssets();
  return { assets, pending: !assets && !failed };
}
