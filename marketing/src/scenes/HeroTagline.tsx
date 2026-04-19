import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { Background } from "../components/Background";
import { LOGOS } from "../components/assets";

const WORDS = ["Build", "Big.", "Automate", "Everything."];

export const HeroTagline: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [108, 130], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const badgeIn = spring({ frame, fps, config: { damping: 20, stiffness: 100 } });
  const paragraphIn = spring({ frame: frame - 60, fps, config: { damping: 20, stiffness: 80 } });
  const statusPulse = 0.4 + ((Math.sin(frame / 8) + 1) / 2) * 0.6;

  return (
    <AbsoluteFill style={{ opacity: fadeIn * fadeOut }}>
      <Background
        image="assets/hero/gondola-station.webp"
        zoom={[1.03, 1.07]}
        pan={{ x: -12, y: -6 }}
        darken={0.55}
        gradient="bottom"
        durationInFrames={134}
      />

      <Img
        src={staticFile(LOGOS.cogsAndSteam)}
        style={{
          position: "absolute",
          top: 64,
          left: 72,
          height: 96,
          width: "auto",
          objectFit: "contain",
          filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.5))",
          opacity: badgeIn,
          transform: `translateY(${(1 - badgeIn) * -12}px)`,
        }}
      />

      <div
        style={{
          position: "absolute",
          top: 84,
          right: 80,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: "8px 16px",
          borderRadius: 6,
          background: "rgba(24, 24, 27, 0.7)",
          border: `1px solid ${theme.border}`,
          color: "#22c55e",
          fontSize: 18,
          fontWeight: 500,
          boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)",
          opacity: badgeIn,
        }}
      >
        <span
          style={{
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "#22c55e",
            opacity: statusPulse,
          }}
        />
        Online
      </div>

      <AbsoluteFill
        style={{
          justifyContent: "flex-end",
          alignItems: "flex-start",
          padding: "0 100px 120px",
        }}
      >
        <div style={{ maxWidth: 1400 }}>
          <div
            style={{
              fontSize: 150,
              fontWeight: 800,
              color: theme.foreground,
              letterSpacing: -4,
              lineHeight: 1,
              display: "flex",
              flexWrap: "wrap",
              gap: "0 28px",
              textShadow: "0 6px 30px rgba(0,0,0,0.7)",
            }}
          >
            {WORDS.map((w, i) => {
              const t = spring({
                frame: frame - (12 + i * 10),
                fps,
                config: { damping: 14, stiffness: 120 },
              });
              const emphasized = w.endsWith(".");
              return (
                <span
                  key={i}
                  style={{
                    display: "inline-block",
                    transform: `translateY(${(1 - t) * 70}px)`,
                    opacity: t,
                    color: emphasized ? theme.primary : theme.foreground,
                    textShadow: emphasized
                      ? `0 0 60px ${theme.primaryGlow}, 0 6px 30px rgba(0,0,0,0.7)`
                      : "0 6px 30px rgba(0,0,0,0.8)",
                  }}
                >
                  {w}
                </span>
              );
            })}
          </div>

          <div
            style={{
              marginTop: 40,
              fontSize: 30,
              lineHeight: 1.5,
              color: "#d8d6de",
              maxWidth: 1100,
              opacity: paragraphIn,
              transform: `translateY(${(1 - paragraphIn) * 20}px)`,
              textShadow: "0 2px 8px rgba(0,0,0,0.8)",
            }}
          >
            A Minecraft server built for players who love clever machines, beautiful
            builds, and total creative freedom.
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
