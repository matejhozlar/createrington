import {
  FlyingAnimation,
  HitAnimation,
  RunningAnimation,
  WalkingAnimation,
  WaveAnimation,
  type PlayerAnimation,
  type PlayerObject,
} from "skinview3d";
import astronautSkinUrl from "@/assets/skins/astronaut.png";
import hulkSkinUrl from "@/assets/skins/hulk.png";
import type { HoverAnimation } from "../data";
import { TeamEffect, type EffectContext } from "./core/effect";
import { loadSkinPixels } from "./core/skin-dissolve";
import { FlashlightHoverEffect } from "./flashlight";
import { HeadKickEffect } from "./headkick";
import { HulkEffect } from "./hulk";
import { JetpackEffect } from "./jetpack";
import { MoonwalkEffect } from "./moonwalk";
import { NukeEffect } from "./nuke";

class BuiltinEffect extends TeamEffect {
  private readonly inner: PlayerAnimation;

  constructor(context: EffectContext, inner: PlayerAnimation) {
    super(context);
    this.inner = inner;
  }

  protected animate(player: PlayerObject, delta: number): void {
    this.inner.update(player, delta);
  }

  protected onStop(): void {
    this.finish();
  }

  dispose(): void {}
}

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
    case "wave":
      return new BuiltinEffect(context, new WaveAnimation());
    case "running":
      return new BuiltinEffect(context, new RunningAnimation());
    case "flying":
      return new BuiltinEffect(context, new FlyingAnimation());
    case "hit":
      return new BuiltinEffect(context, new HitAnimation());
    case "walking":
      return new BuiltinEffect(context, new WalkingAnimation());
  }
}

export function preloadEffectSkins(): void {
  for (const url of [astronautSkinUrl, hulkSkinUrl]) {
    loadSkinPixels(url).catch(() => {});
  }
}
