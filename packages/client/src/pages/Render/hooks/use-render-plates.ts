import { usePlateAssets } from "@/features/team-tag/hooks/use-plate-assets";

export function useRenderPlatesReady(): boolean {
  const { assets, failed } = usePlateAssets();
  return assets !== null || failed;
}
