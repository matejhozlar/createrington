import { PlayerAnimation, type SkinViewer } from "skinview3d";
import type { Bleed } from "./view";

export type EffectContext = {
  viewer: SkinViewer;
  username: string;
  card: HTMLElement | null;
  setBleed: (bleed: Bleed) => void;
  onFinished: () => void;
};

export abstract class TeamEffect extends PlayerAnimation {
  protected readonly viewer: SkinViewer;
  protected readonly username: string;
  protected readonly card: HTMLElement | null;
  protected readonly setBleed: (bleed: Bleed) => void;
  protected stoppedAt: number | null = null;
  private readonly onFinished: () => void;
  private finished = false;

  constructor(context: EffectContext) {
    super();
    this.viewer = context.viewer;
    this.username = context.username;
    this.card = context.card;
    this.setBleed = context.setBleed;
    this.onFinished = context.onFinished;
  }

  stop(): void {
    if (this.stoppedAt !== null) return;
    this.stoppedAt = this.progress;
    this.onStop();
  }

  abstract dispose(): void;

  protected onStop(): void {}

  protected finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.onFinished();
  }
}
