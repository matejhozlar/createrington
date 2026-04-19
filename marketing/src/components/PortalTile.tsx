import React, { useId } from "react";
import { Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

// Mirrors the mod's texture animation metadata at
// parallel-worlds/src/main/resources/assets/parallelworlds/textures/block/pw_portal.png.mcmeta
//   { "animation": { "frametime": 3, "interpolate": true } }
//
// The atlas is 16×256 — sixteen 16×16 frames stacked vertically. Minecraft
// runs at 20 ticks/sec, so frametime 3 = 3/20 s = 150 ms per frame.
// `interpolate: true` means the game crossfades between consecutive frames
// rather than hard-cutting; we replicate that here with two stacked layers.
const TOTAL_FRAMES = 16;
const FRAMETIME_TICKS = 3;
const MC_TICKS_PER_SECOND = 20;

type PortalTileProps = {
  width: number;                 // rendered width in px
  height?: number;               // rendered height in px; defaults to width (square block)
  tileSize?: number;             // when set, tile the 16px frame at this size across
                                 // width×height via an SVG <pattern> — seamless blocks
                                 // instead of one stretched face
  offsetSeconds?: number;        // phase offset so neighbouring tiles can desync
};

// Renders an animated portal face. Two modes:
//   - default (no tileSize): the 16×16 source stretches to fill width×height
//   - tiled (tileSize set):  the 16×16 source tiles seamlessly across the
//     surface via an SVG pattern — each tile renders as a discrete block
//     with pixel-perfect borders, which is what the mod looks like in-game
//     when you stand in front of a multi-block portal
export const PortalTile: React.FC<PortalTileProps> = ({
  width,
  height,
  tileSize,
  offsetSeconds = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const patternKey = useId().replace(/:/g, "");

  const h = height ?? width;
  const secondsPerTexFrame = FRAMETIME_TICKS / MC_TICKS_PER_SECOND;          // 0.15s
  const videoFramesPerTexFrame = secondsPerTexFrame * fps;                   // e.g. 4.5 @ 30fps

  const cyclePos =
    ((frame + offsetSeconds * fps) / videoFramesPerTexFrame) % TOTAL_FRAMES;
  const currentIdx = Math.floor(cyclePos);
  const lerp = cyclePos - currentIdx;
  const nextIdx = (currentIdx + 1) % TOTAL_FRAMES;
  const src = staticFile("assets/parallel-worlds/pw_portal.png");

  if (tileSize) {
    // SVG <pattern> tiles the current atlas frame seamlessly at tileSize
    // across the whole surface. Two stacked <rect>s crossfade the current
    // and next frame to replicate the mod's interpolate: true setting.
    const patternCurr = `pw-${patternKey}-${currentIdx}`;
    const patternNext = `pw-${patternKey}-${nextIdx}-b`;
    return (
      <svg width={width} height={h} style={{ display: "block" }}>
        <defs>
          <pattern
            id={patternCurr}
            x={0}
            y={0}
            width={tileSize}
            height={tileSize}
            patternUnits="userSpaceOnUse"
          >
            <image
              href={src}
              x={0}
              y={-currentIdx * tileSize}
              width={tileSize}
              height={tileSize * TOTAL_FRAMES}
              preserveAspectRatio="none"
              style={{ imageRendering: "pixelated" }}
            />
          </pattern>
          <pattern
            id={patternNext}
            x={0}
            y={0}
            width={tileSize}
            height={tileSize}
            patternUnits="userSpaceOnUse"
          >
            <image
              href={src}
              x={0}
              y={-nextIdx * tileSize}
              width={tileSize}
              height={tileSize * TOTAL_FRAMES}
              preserveAspectRatio="none"
              style={{ imageRendering: "pixelated" }}
            />
          </pattern>
        </defs>
        <rect width={width} height={h} fill={`url(#${patternCurr})`} opacity={1 - lerp} />
        <rect width={width} height={h} fill={`url(#${patternNext})`} opacity={lerp} />
      </svg>
    );
  }

  // Fallback: stretched single-face rendering via two stacked <Img>s.
  const atlasHeight = h * TOTAL_FRAMES;
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
    <div style={{ position: "relative", width, height: h, overflow: "hidden" }}>
      <Img src={src} style={atlasStyle(currentIdx, 1 - lerp)} />
      <Img src={src} style={atlasStyle(nextIdx, lerp)} />
    </div>
  );
};
