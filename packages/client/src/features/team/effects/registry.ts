import astronautSkinUrl from "@/assets/skins/astronaut.png";
import hulkSkinUrl from "@/assets/skins/hulk.png";
import type { HoverAnimation } from "../data";
import type { TeamEffect, EffectContext } from "./core/effect";
import { loadSkinPixels } from "./core/skin-dissolve";
import { ExplodeEffect } from "./explode";
import { FlashlightHoverEffect } from "./flashlight";
import { HeadKickEffect } from "./headkick";
import { HulkEffect } from "./hulk";
import { JetpackEffect } from "./jetpack";
import { MoonwalkEffect } from "./moonwalk";
import { NukeEffect } from "./nuke";

export function createEffect(
  type: HoverAnimation,
  context: EffectContext,
): TeamEffect {
  switch (type) {
    case "jetpack":
      return new JetpackEffect(context);
    case "hulk":
      return new HulkEffect(context);
    case "nuke":
      return new NukeEffect(context);
    case "flashlight":
      return new FlashlightHoverEffect(context);
    case "moonwalk":
      return new MoonwalkEffect(context);
    case "headkick":
      return new HeadKickEffect(context);
    case "explode":
      return new ExplodeEffect(context);
  }
}

export function preloadEffectSkins(): void {
  for (const url of [astronautSkinUrl, hulkSkinUrl]) {
    loadSkinPixels(url).catch(() => {});
  }
}
