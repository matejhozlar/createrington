import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { theme } from "../theme";

type BackgroundProps = {
  image?: string;                  // staticFile path, e.g. "assets/hero/dark-warehouse.webp"
  images?: string[];               // crossfade between multiple
  zoom?: [number, number];         // start, end scale (default 1 → 1.08)
  pan?: { x: number; y: number };  // translation in pixels across the scene
  blur?: number;                   // pixels
  darken?: number;                 // 0..1, strength of dark overlay
  tint?: string;                   // optional color wash
  gradient?: "bottom" | "both" | "radial" | "none";
  showGrid?: boolean;
  // Scene-local duration (so Ken-Burns math spans the scene, not the whole composition).
  // Defaults to a safe 180 frames (6s).
  durationInFrames?: number;
};

// Ken-Burns image background with heavy cinematic grading to match the
// dark + amber app palette. Used as the backdrop for every scene.
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

  // Crossfade over list
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

      {/* Dark overlay */}
      <AbsoluteFill style={{ backgroundColor: `rgba(15, 14, 18, ${darken})` }} />

      {/* Optional amber color wash */}
      {tint && (
        <AbsoluteFill
          style={{
            background: `linear-gradient(135deg, ${tint} 0%, transparent 60%)`,
            mixBlendMode: "overlay",
            opacity: 0.6,
          }}
        />
      )}

      {/* Bottom gradient so text is always legible */}
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

      {/* Subtle noise-like tech grid, very faint */}
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

      {/* Amber glow accent (subtle) */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 70% 30%, ${theme.primarySoft} 0%, transparent 45%)`,
          opacity: 0.8,
        }}
      />
    </AbsoluteFill>
  );
};
