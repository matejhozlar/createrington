import { PlayerAnimation, type PlayerObject } from "skinview3d";
import {
  bump,
  easeInOutCubic,
  easeOutBack,
  prefersReducedMotion,
  span,
} from "./math";
import type { Point } from "./screen";
import { stage, type GuestAnimation, type GuestHandle } from "./stage";

const FLINCH_IN_SECONDS = 0.16;
const FLINCH_OUT_SECONDS = 0.45;

class FlinchAnimation extends PlayerAnimation implements GuestAnimation {
  private readonly side: -1 | 1;
  private readonly hold: number;
  private readonly done: () => void;

  constructor(side: -1 | 1, hold: number, done: () => void) {
    super();
    this.side = side;
    this.hold = hold;
    this.done = done;
  }

  protected animate(player: PlayerObject): void {
    const time = this.progress;
    const releaseAt = FLINCH_IN_SECONDS + this.hold;
    const weight =
      easeOutBack(span(time, 0, FLINCH_IN_SECONDS)) *
      (1 -
        easeInOutCubic(span(time, releaseAt, releaseAt + FLINCH_OUT_SECONDS)));
    const skin = player.skin;
    const shield = this.side > 0 ? skin.leftArm : skin.rightArm;
    const brace = this.side > 0 ? skin.rightArm : skin.leftArm;

    skin.head.rotation.x = -0.12 * weight;
    skin.head.rotation.y = this.side * 0.5 * weight;
    skin.body.rotation.x = -0.14 * weight;
    skin.body.rotation.z = this.side * 0.08 * weight;
    shield.rotation.x = -1.9 * weight;
    shield.rotation.z = -this.side * 0.45 * weight;
    brace.rotation.x = 0.4 * weight;
    brace.rotation.z = -this.side * (0.06 + 0.4 * weight);
    skin.leftLeg.rotation.x = (this.side > 0 ? 0.25 : -0.1) * weight;
    skin.rightLeg.rotation.x = (this.side > 0 ? -0.1 : 0.25) * weight;
    player.rotation.z = this.side * 0.07 * weight;
    player.position.y = bump(span(time, 0, 0.26)) * 0.9;

    if (time >= releaseAt + FLINCH_OUT_SECONDS) this.done();
  }
}

export function flinchOthers(
  source: string,
  origin: Point,
  radius: number,
  hold: number,
): GuestHandle[] {
  const handles: GuestHandle[] = [];
  for (const member of stage.others(source)) {
    const rect = member.viewer.canvas.getBoundingClientRect();
    const offset = origin.x - (rect.left + rect.width / 2);
    if (Math.abs(offset) > radius) continue;
    const handle = member.playGuest(
      (_viewer, done) => new FlinchAnimation(offset >= 0 ? 1 : -1, hold, done),
    );
    if (handle) handles.push(handle);
  }
  return handles;
}

export function hopOthers(
  source: string,
  origin: Point,
  strength: number,
): void {
  if (prefersReducedMotion()) return;
  for (const member of stage.others(source)) {
    const card = member.card;
    if (!card) continue;
    const rect = card.getBoundingClientRect();
    const distance = Math.abs(rect.left + rect.width / 2 - origin.x);
    const height = (18 * strength) / (1 + distance / 260);
    card.animate(
      [
        { translate: "0 0", easing: "cubic-bezier(0.2, 0.8, 0.4, 1)" },
        {
          translate: `0 ${(-height).toFixed(1)}px`,
          easing: "cubic-bezier(0.6, 0, 0.9, 0.4)",
        },
        { translate: "0 0" },
      ],
      { duration: 360, delay: distance * 0.4 },
    );
  }
}
