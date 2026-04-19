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
      {/* Single calm hero — same gondola-station shot the site leads with */}
      <Background
        image="assets/hero/gondola-station.webp"
        zoom={[1.03, 1.07]}
        pan={{ x: -12, y: -6 }}
        darken={0.55}
        gradient="bottom"
        durationInFrames={134}
      />

      {/* Top-left logo badge */}
      <div
        style={{
          position: "absolute",
          top: 64,
          left: 72,
          display: "flex",
          alignItems: "center",
          gap: 16,
          opacity: badgeIn,
          transform: `translateY(${(1 - badgeIn) * -12}px)`,
        }}
      >
        <Img
          src={staticFile(LOGOS.cogsAndSteam)}
          style={{ width: 120, height: "auto", filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.5))" }}
        />
      </div>

      {/* Top-right LIVE badge */}
      <div
        style={{
          position: "absolute",
          top: 84,
          right: 80,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 20px",
          borderRadius: 999,
          background: "rgba(15,14,18,0.7)",
          backdropFilter: "blur(12px)",
          border: `1px solid ${theme.success}55`,
          color: theme.success,
          fontSize: 16,
          fontWeight: 600,
          letterSpacing: 2,
          textTransform: "uppercase",
          opacity: badgeIn,
        }}
      >
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: theme.success,
            opacity: statusPulse,
            boxShadow: `0 0 ${4 + statusPulse * 10}px ${theme.success}`,
          }}
        />
        Server Online
      </div>

      {/* Main tagline */}
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
