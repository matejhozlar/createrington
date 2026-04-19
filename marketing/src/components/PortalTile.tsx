import React from "react";
import { Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

// Mirrors the mod's texture animation metadata at
// parallel-worlds/src/main/resources/assets/parallelworlds/textures/block/pw_portal.png.mcmeta
//   { "animation": { "frametime": 3, "interpolate": true } }
//
// The atlas is 16×256 — sixteen 16×16 frames stacked vertically. Minecraft
// runs at 20 ticks/sec, so frametime 3 = 3/20 s = 150 ms per frame.
// `interpolate: true` means the game crossfades between consecutive frames
// rather than hard-cutting; we replicate that here with two stacked `<Img>`s.
const TOTAL_FRAMES = 16;
const FRAMETIME_TICKS = 3;
const MC_TICKS_PER_SECOND = 20;

type PortalTileProps = {
  width: number;                 // rendered width in px (texture stretches/tiles to fit)
  height?: number;               // rendered height in px; defaults to width (square block)
  offsetSeconds?: number;        // phase offset so neighbouring tiles can desync
};

// A single animated portal face. The source frame is 16×16 and is stretched
// to fill the requested width×height — so you can drop one tile in for a
// single block, or stretch one across a whole portal interior to keep the
// animation continuous across cells.
export const PortalTile: React.FC<PortalTileProps> = ({
  width,
  height,
  offsetSeconds = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const h = height ?? width;
  const secondsPerTexFrame = FRAMETIME_TICKS / MC_TICKS_PER_SECOND;          // 0.15s
  const videoFramesPerTexFrame = secondsPerTexFrame * fps;                   // e.g. 4.5 @ 30fps

  const cyclePos =
    ((frame + offsetSeconds * fps) / videoFramesPerTexFrame) % TOTAL_FRAMES;
  const currentIdx = Math.floor(cyclePos);
  const lerp = cyclePos - currentIdx;
  const nextIdx = (currentIdx + 1) % TOTAL_FRAMES;

  const atlasHeight = h * TOTAL_FRAMES;
  const src = staticFile("assets/parallel-worlds/pw_portal.png");

  const atlasStyle = (idx: number, opacity: number): React.CSSProperties => ({
    position: "absolute",
    top: -idx * h,
    left: 0,
    width,
    height: atlasHeight,
    imageRendering: "pixelated",
    opacity,
  });

  return (
    <div
      style={{
        position: "relative",
        width,
        height: h,
        overflow: "hidden",
      }}
    >
      <Img src={src} style={atlasStyle(currentIdx, 1 - lerp)} />
      <Img src={src} style={atlasStyle(nextIdx, lerp)} />
    </div>
  );
};
