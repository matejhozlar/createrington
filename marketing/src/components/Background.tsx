import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { theme } from "../theme";

type BackgroundProps = {
  image?: string;
  images?: string[];
  zoom?: [number, number];
  pan?: { x: number; y: number };
  blur?: number;
  darken?: number;
  tint?: string;
  gradient?: "bottom" | "both" | "radial" | "none";
  showGrid?: boolean;
  // Scene-local duration so Ken-Burns math spans this scene, not the
  // whole composition (useVideoConfig returns composition duration).
  durationInFrames?: number;
};

export const Background: React.FC<BackgroundProps> = ({
  image,
  images,
  zoom = [1.04, 1.14],
  pan = { x: 0, y: 0 },
  blur = 0,
  darken = 0.55,
  tint,
  gradient = "both",
  showGrid = false,
  durationInFrames = 180,
}) => {
  const frame = useCurrentFrame();

  const list = images ?? (image ? [image] : []);
  const progress = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scale = interpolate(progress, [0, 1], zoom);
  const tx = pan.x * progress;
  const ty = pan.y * progress;

  const segLen = list.length > 0 ? durationInFrames / list.length : 0;

  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: theme.backgroundDeep }}>
      {list.map((src, i) => {
        const start = i * segLen;
        const end = start + segLen;
        const fadeIn = interpolate(frame, [start, start + 20], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const fadeOut =
          i === list.length - 1
            ? 1
            : interpolate(frame, [end - 30, end + 10], [1, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
        return (
          <AbsoluteFill
            key={src + i}
            style={{ opacity: fadeIn * fadeOut }}
          >
            <Img
              src={staticFile(src)}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transform: `scale(${scale}) translate(${tx}px, ${ty}px)`,
                filter: blur > 0 ? `blur(${blur}px)` : undefined,
              }}
            />
          </AbsoluteFill>
        );
      })}

      <AbsoluteFill style={{ backgroundColor: `rgba(15, 14, 18, ${darken})` }} />

      {tint && (
        <AbsoluteFill
          style={{
            background: `linear-gradient(135deg, ${tint} 0%, transparent 60%)`,
            mixBlendMode: "overlay",
            opacity: 0.6,
          }}
        />
      )}

      {(gradient === "bottom" || gradient === "both") && (
        <AbsoluteFill
          style={{
            background: `linear-gradient(to top, ${theme.backgroundDeep} 0%, rgba(15,14,18,0.85) 25%, rgba(15,14,18,0.35) 55%, transparent 85%)`,
          }}
        />
      )}
      {gradient === "both" && (
        <AbsoluteFill
          style={{
            background: `linear-gradient(to bottom, rgba(15,14,18,0.6) 0%, transparent 45%)`,
          }}
        />
      )}
      {gradient === "radial" && (
        <AbsoluteFill
          style={{
            background: `radial-gradient(ellipse at center, transparent 20%, rgba(15,14,18,0.85) 85%)`,
          }}
        />
      )}

      {showGrid && (
        <AbsoluteFill
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)," +
              "linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
            backgroundSize: "80px 80px",
            maskImage: "radial-gradient(ellipse at center, black 30%, transparent 80%)",
            WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 80%)",
          }}
        />
      )}

      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 70% 30%, ${theme.primarySoft} 0%, transparent 45%)`,
          opacity: 0.8,
        }}
      />
    </AbsoluteFill>
  );
};
