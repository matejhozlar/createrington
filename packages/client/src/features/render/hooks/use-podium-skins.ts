import { useEffect, useState } from "react";
import { loadSkin, randomPose } from "../skin-utils";
import type { RenderPodiumPlayer } from "@createrington/shared/render";

export function usePodiumSkins(
  players: RenderPodiumPlayer[] | null,
): string[] | null {
  const [skins, setSkins] = useState<string[] | null>(null);
  const [poses] = useState(() => [randomPose(), randomPose(), randomPose()]);

  useEffect(() => {
    if (!players) return;
    void Promise.all(
      players.map((player, index) => loadSkin(player.uuid, poses[index])),
    ).then(setSkins);
  }, [players, poses]);

  return skins;
}
