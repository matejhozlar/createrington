import { useEffect, useRef } from "react";
import {
  SkinViewer as SkinViewerLib,
  IdleAnimation,
  WalkingAnimation,
  WaveAnimation,
  RunningAnimation,
  FlyingAnimation,
  HitAnimation,
} from "skinview3d";
import type { HoverAnimation } from "../data";

type SkinViewerProps = {
  uuid: string;
  width: number;
  height: number;
  hoverAnimation?: HoverAnimation;
  className?: string;
};

function createAnimation(type: HoverAnimation) {
  switch (type) {
    case "wave": return new WaveAnimation();
    case "running": return new RunningAnimation();
    case "flying": return new FlyingAnimation();
    case "hit": return new HitAnimation();
    case "walking": return new WalkingAnimation();
  }
}

export const SkinViewer = ({ uuid, width, height, hoverAnimation = "walking", className }: SkinViewerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<SkinViewerLib | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const viewer = new SkinViewerLib({
      width,
      height,
      enableControls: false,
      fov: 50,
      zoom: 0.9,
    });

    viewer.autoRotate = false;
    viewer.animation = new IdleAnimation();

    viewer.loadSkin(`https://crafatar.com/skins/${uuid}`).catch(() => {
      viewer.loadSkin(`https://mc-heads.net/skin/${uuid}`).catch(() => {});
    });

    container.appendChild(viewer.canvas);
    viewerRef.current = viewer;

    return () => {
      viewer.dispose();
      if (container.contains(viewer.canvas)) {
        container.removeChild(viewer.canvas);
      }
      viewerRef.current = null;
    };
  }, [uuid, width, height]);

  const handleMouseEnter = () => {
    if (viewerRef.current) {
      viewerRef.current.animation = createAnimation(hoverAnimation);
    }
  };

  const handleMouseLeave = () => {
    if (viewerRef.current) {
      viewerRef.current.animation = new IdleAnimation();
    }
  };

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width, height }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    />
  );
};
