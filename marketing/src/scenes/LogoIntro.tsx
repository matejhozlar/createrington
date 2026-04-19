import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { Background } from "../components/Background";
import { LOGOS } from "../components/assets";

export const LogoIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoIn = spring({ frame: frame - 8, fps, config: { damping: 16, stiffness: 110 } });
  const taglineIn = spring({ frame: frame - 40, fps, config: { damping: 20, stiffness: 90 } });
  const lineIn = spring({ frame: frame - 56, fps, config: { damping: 22, stiffness: 80 } });

  const fadeOut = interpolate(frame, [78, 96], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const glowPulse = 0.6 + ((Math.sin(frame / 12) + 1) / 2) * 0.4;

  return (
    <AbsoluteFill style={{ opacity: fadeOut }}>
      <Background
        image="assets/hero/gondola-station.webp"
        zoom={[1.02, 1.05]}
        pan={{ x: -6, y: 0 }}
        darken={0.78}
        gradient="radial"
        durationInFrames={104}
      />

      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: 80 }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              width: 900,
              height: 500,
              borderRadius: "50%",
              background: `radial-gradient(ellipse, ${theme.primaryGlow} 0%, transparent 60%)`,
              filter: "blur(20px)",
              opacity: logoIn * glowPulse * 0.85,
              pointerEvents: "none",
            }}
          />

          <Img
            src={staticFile(LOGOS.cogsAndSteam)}
            style={{
              width: 760,
              height: "auto",
              objectFit: "contain",
              transform: `scale(${logoIn}) translateY(${(1 - logoIn) * 30}px)`,
              opacity: logoIn,
              filter: `drop-shadow(0 20px 60px rgba(0,0,0,0.6)) drop-shadow(0 0 40px ${theme.primaryGlow})`,
              position: "relative",
            }}
          />

          <div
            style={{
              marginTop: 40,
              height: 2,
              width: 360 * lineIn,
              background: `linear-gradient(90deg, transparent 0%, ${theme.primary} 50%, transparent 100%)`,
              opacity: lineIn,
            }}
          />

          <div
            style={{
              marginTop: 28,
              fontSize: 26,
              letterSpacing: 6,
              color: theme.mutedForeground,
              textTransform: "uppercase",
              fontWeight: 500,
              opacity: taglineIn,
              transform: `translateY(${(1 - taglineIn) * 16}px)`,
            }}
          >
            A Create-Powered Minecraft Community
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
