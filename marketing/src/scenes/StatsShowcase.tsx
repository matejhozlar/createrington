import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { Background } from "../components/Background";
import { AnimatedCounter } from "../components/AnimatedCounter";

const STATS = [
  { value: 247, label: "Registered Players", suffix: "", tint: theme.chart.blue, icon: "users" },
  { value: 18420, label: "Hours Played", suffix: "", tint: theme.primary, icon: "clock" },
  { value: 120, label: "Curated Mods", suffix: "+", tint: theme.chart.green, icon: "stack" },
  { value: 24, label: "Always On", suffix: "/7", tint: theme.chart.purple, icon: "lightning" },
];

const renderIcon = (kind: string, color: string) => {
  const common = { width: 32, height: 32, fill: "none", stroke: color, strokeWidth: 2 } as const;
  if (kind === "users") {
    return (
      <svg viewBox="0 0 24 24" {...common}>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
  }
  if (kind === "clock") {
    return (
      <svg viewBox="0 0 24 24" {...common}>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    );
  }
  if (kind === "stack") {
    return (
      <svg viewBox="0 0 24 24" {...common}>
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" {...common}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
};

export const StatsShowcase: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [138, 160], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const headerIn = spring({ frame, fps, config: { damping: 18, stiffness: 100 } });

  return (
    <AbsoluteFill style={{ opacity: fadeIn * fadeOut }}>
      <Background
        image="assets/hero/space-ship-station.webp"
        zoom={[1.05, 1.15]}
        blur={6}
        darken={0.75}
        gradient="both"
        durationInFrames={164}
      />

      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          padding: "0 120px",
        }}
      >
        <div
          style={{
            fontSize: 22,
            letterSpacing: 8,
            color: theme.primary,
            fontWeight: 600,
            textTransform: "uppercase",
            marginBottom: 16,
            opacity: headerIn,
            transform: `translateY(${(1 - headerIn) * 20}px)`,
          }}
        >
          A Thriving Community
        </div>
        <h2
          style={{
            fontSize: 76,
            fontWeight: 700,
            color: theme.foreground,
            marginBottom: 72,
            textAlign: "center",
            letterSpacing: -2,
            opacity: headerIn,
            transform: `translateY(${(1 - headerIn) * 30}px)`,
            textShadow: "0 4px 24px rgba(0,0,0,0.6)",
          }}
        >
          By the Numbers
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 28,
            width: "100%",
            maxWidth: 1560,
          }}
        >
          {STATS.map((s, i) => {
            const delay = 18 + i * 10;
            const cardIn = spring({
              frame: frame - delay,
              fps,
              config: { damping: 16, stiffness: 110 },
            });
            return (
              <div
                key={i}
                style={{
                  background: "rgba(30, 28, 35, 0.82)",
                  backdropFilter: "blur(14px)",
                  border: `1px solid ${theme.border}`,
                  borderRadius: 24,
                  padding: "44px 32px",
                  textAlign: "left",
                  opacity: cardIn,
                  transform: `translateY(${(1 - cardIn) * 40}px) scale(${0.96 + cardIn * 0.04})`,
                  boxShadow: `0 20px 60px rgba(0,0,0,0.5)`,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: -80,
                    right: -80,
                    width: 220,
                    height: 220,
                    borderRadius: "50%",
                    background: `radial-gradient(circle, ${s.tint}33 0%, transparent 70%)`,
                  }}
                />
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 14,
                    background: `${s.tint}1a`,
                    border: `1px solid ${s.tint}44`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 28,
                  }}
                >
                  {renderIcon(s.icon, s.tint)}
                </div>
                <div
                  style={{
                    fontSize: 84,
                    fontWeight: 800,
                    color: theme.foreground,
                    lineHeight: 1,
                    marginBottom: 16,
                    letterSpacing: -2,
                  }}
                >
                  <AnimatedCounter
                    to={s.value}
                    durationInFrames={60}
                    delay={delay + 6}
                    suffix={s.suffix}
                    style={{ color: s.tint }}
                  />
                </div>
                <div
                  style={{
                    fontSize: 18,
                    color: theme.mutedForeground,
                    fontWeight: 500,
                    textTransform: "uppercase",
                    letterSpacing: 1.5,
                  }}
                >
                  {s.label}
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
