import React, { useId } from "react";
import { Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

const TOTAL_FRAMES = 32;
const FRAME_DURATION_SECONDS = 0.085;

type PortalTileProps = {
  width: number;
  height?: number;
  tileSize?: number;
  offsetSeconds?: number;
};

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
  const videoFramesPerTexFrame = FRAME_DURATION_SECONDS * fps;

  const cyclePos =
    ((frame + offsetSeconds * fps) / videoFramesPerTexFrame) % TOTAL_FRAMES;
  const currentIdx = Math.floor(cyclePos);
  const lerp = cyclePos - currentIdx;
  const nextIdx = (currentIdx + 1) % TOTAL_FRAMES;
  const src = staticFile("assets/parallel-worlds/pw_portal.png");

  if (tileSize) {
    const patternId = `pw-${patternKey}`;
    return (
      <svg width={width} height={h} style={{ display: "block" }} shapeRendering="crispEdges">
        <defs>
          <pattern
            id={patternId}
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
            <image
              href={src}
              x={0}
              y={-nextIdx * tileSize}
              width={tileSize}
              height={tileSize * TOTAL_FRAMES}
              preserveAspectRatio="none"
              style={{ imageRendering: "pixelated" }}
              opacity={lerp}
            />
          </pattern>
        </defs>
        <rect width={width} height={h} fill={`url(#${patternId})`} />
      </svg>
    );
  }

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
      <Img src={src} style={atlasStyle(currentIdx, 1)} />
      <Img src={src} style={atlasStyle(nextIdx, lerp)} />
    </div>
  );
};
