import type { PlayerAnimation, SkinViewer } from "skinview3d";
import { prefersReducedMotion } from "./math";
import type { Point } from "./screen";

export interface GuestAnimation extends PlayerAnimation {
  dispose?(): void;
}

export type GuestFactory = (
  viewer: SkinViewer,
  done: () => void,
) => GuestAnimation;

export type GuestHandle = { cancel(): void };

export type StageMember = {
  username: string;
  viewer: SkinViewer;
  card: HTMLElement | null;
  isBusy(): boolean;
  playGuest(create: GuestFactory): GuestHandle | null;
};

type Attention = { source: string; getPoint: () => Point | null };

type Tremor = { frameId: number; amplitude: number; target: HTMLElement };

class Stage {
  root: HTMLElement | null = null;

  private readonly members = new Map<string, StageMember>();
  private attention: Attention | null = null;
  private tremor: Tremor | null = null;

  register(member: StageMember): () => void {
    this.members.set(member.username, member);
    return () => {
      if (this.members.get(member.username) === member) {
        this.members.delete(member.username);
      }
    };
  }

  all(): StageMember[] {
    return [...this.members.values()];
  }

  others(username: string): StageMember[] {
    return this.all().filter((member) => member.username !== username);
  }

  focus(source: string, getPoint: () => Point | null): void {
    this.attention = { source, getPoint };
  }

  blur(source: string): void {
    if (this.attention?.source === source) this.attention = null;
  }

  attentionFor(username: string): Point | null {
    if (!this.attention || this.attention.source === username) return null;
    return this.attention.getPoint();
  }

  shake(amplitude: number, duration: number): void {
    if (prefersReducedMotion()) return;
    const target = this.root;
    if (!target) return;
    if (this.tremor && this.tremor.amplitude > amplitude) return;
    this.stopTremor();

    const start = performance.now();
    const step = (now: number) => {
      const t = (now - start) / duration;
      if (t >= 1) {
        this.stopTremor();
        return;
      }
      const reach = amplitude * (1 - t) ** 2;
      const x = (Math.random() * 2 - 1) * reach;
      const y = (Math.random() * 2 - 1) * reach;
      target.style.translate = `${x.toFixed(1)}px ${y.toFixed(1)}px`;
      this.tremor = { frameId: requestAnimationFrame(step), amplitude, target };
    };
    this.tremor = { frameId: requestAnimationFrame(step), amplitude, target };
  }

  reset(): void {
    this.stopTremor();
    this.attention = null;
  }

  private stopTremor(): void {
    if (!this.tremor) return;
    cancelAnimationFrame(this.tremor.frameId);
    this.tremor.target.style.translate = "";
    this.tremor = null;
  }
}

export const stage = new Stage();
