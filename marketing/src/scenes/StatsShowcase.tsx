import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { Background } from "../components/Background";
import { NumberCountUp } from "../components/NumberCountUp";

const STATS = [
  {
    icon: "users",
    target: 100,
    suffix: "+",
    title: "Registered Members",
    description: "Verified community members",
  },
  {
    icon: "clock",
    target: 10000,
    suffix: "+",
    title: "Hours Played",
    description: "Total playtime across all players",
  },
  {
    icon: "package",
    target: 200,
    suffix: "+",
    title: "Curated Mods",
    description: "Hand-picked for balance and performance",
  },
  {
    icon: "download",
    target: 300,
    suffix: "K+",
    title: "Mod Downloads",
    description: "Our team's published mods on Curseforge & Modrinth",
  },
];

const iconBase = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const Icon: React.FC<{ kind: string; size: number }> = ({ kind, size }) => {
  const common = { width: size, height: size, ...iconBase };
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
  if (kind === "download") {
    return (
      <svg viewBox="0 0 24 24" {...common}>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" {...common}>
      <path d="M16.5 9.4 7.55 4.24" />
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.29 7 12 12 20.71 7" />
      <line x1="12" y1="22" x2="12" y2="12" />
    </svg>
  );
};

const IconBadge: React.FC<{ kind: string; delay: number }> = ({ kind, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const badgeIn = spring({
    frame: frame - delay,
    fps,
    config: { damping: 16, stiffness: 140 },
  });
  const ringProgress = interpolate(frame, [delay + 6, delay + 52], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const breath = 0.65 + ((Math.sin(frame / 14) + 1) / 2) * 0.35;

  const outer = 96;            // overall badge diameter
  const ringR = outer / 2 - 2; // inside of stroke
  const circ = 2 * Math.PI * ringR;

  return (
    <div
      style={{
        width: outer,
        height: outer,
        position: "relative",
        transform: `scale(${0.6 + badgeIn * 0.4})`,
        opacity: badgeIn,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: -22,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${theme.primaryGlow} 0%, transparent 65%)`,
          opacity: breath * 0.9,
          filter: "blur(6px)",
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: theme.primarySoft,
        }}
      />

      <svg
        width={outer}
        height={outer}
        style={{
          position: "absolute",
          inset: 0,
          transform: "rotate(-90deg)",
        }}
      >
        <circle
          cx={outer / 2}
          cy={outer / 2}
          r={ringR}
          fill="none"
          stroke={theme.primary}
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - ringProgress)}
          opacity={0.85}
        />
      </svg>

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: theme.primary,
        }}
      >
        <Icon kind={kind} size={44} />
      </div>
    </div>
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
        blur={8}
        darken={0.82}
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
        <h2
          style={{
            fontSize: 76,
            fontWeight: 600,
            color: theme.foreground,
            textAlign: "center",
            letterSpacing: -1,
            margin: 0,
            opacity: headerIn,
            transform: `translateY(${(1 - headerIn) * 30}px)`,
          }}
        >
          Join a Thriving Community
        </h2>
        <p
          style={{
            marginTop: 14,
            fontSize: 26,
            color: theme.primary,
            textAlign: "center",
            maxWidth: 720,
            opacity: headerIn,
            transform: `translateY(${(1 - headerIn) * 20}px)`,
          }}
        >
          Our server is home to a vibrant community of builders and creators
        </p>

        <div
          style={{
            marginTop: 64,
            display: "grid",
            gridTemplateColumns: `repeat(${STATS.length}, 1fr)`,
            gap: 22,
            width: "100%",
            maxWidth: 1680,
          }}
        >
          {STATS.map((s, i) => {
            const delay = 18 + i * 10;
            const cardIn = spring({
              frame: frame - delay,
              fps,
              config: { damping: 16, stiffness: 110 },
            });
            const valueSettle = interpolate(frame, [delay + 40, delay + 56, delay + 72], [0.9, 1.06, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const accentProgress = interpolate(frame, [delay + 44, delay + 78], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });

            return (
              <div
                key={s.title}
                style={{
                  position: "relative",
                  background:
                    "linear-gradient(180deg, rgba(30, 28, 35, 0.92) 0%, rgba(15, 14, 18, 0.92) 100%)",
                  border: `1px solid ${theme.border}`,
                  borderRadius: 24,
                  padding: "44px 32px 40px",
                  textAlign: "center",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 20,
                  opacity: cardIn,
                  transform: `translateY(${(1 - cardIn) * 40}px) scale(${0.96 + cardIn * 0.04})`,
                  boxShadow: "0 30px 80px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04)",
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
                    background: `radial-gradient(circle, ${theme.primarySoft} 0%, transparent 70%)`,
                    pointerEvents: "none",
                  }}
                />

                <IconBadge kind={s.icon} delay={delay + 4} />

                <div style={{ position: "relative", display: "inline-flex", alignItems: "baseline" }}>
                  <div
                    style={{
                      position: "absolute",
                      inset: -20,
                      background: `radial-gradient(ellipse at center, ${theme.primaryGlow} 0%, transparent 60%)`,
                      filter: "blur(12px)",
                      opacity: cardIn * 0.7,
                      pointerEvents: "none",
                    }}
                  />
                  <NumberCountUp
                    to={s.target}
                    delay={delay + 10}
                    durationInFrames={54}
                    suffix={s.suffix}
                    style={{
                      fontSize: 96,
                      fontWeight: 800,
                      color: theme.foreground,
                      letterSpacing: -3,
                      lineHeight: 1,
                      transform: `scale(${valueSettle})`,
                      textShadow: `0 0 40px ${theme.primaryGlow}`,
                    }}
                  />
                </div>

                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 600,
                    color: theme.foreground,
                  }}
                >
                  {s.title}
                </div>

                <div
                  style={{
                    fontSize: 17,
                    color: theme.mutedForeground,
                    lineHeight: 1.4,
                    maxWidth: 300,
                  }}
                >
                  {s.description}
                </div>

                <div
                  style={{
                    position: "absolute",
                    left: 32,
                    right: 32,
                    bottom: 20,
                    height: 2,
                    background: "rgba(255,255,255,0.06)",
                    borderRadius: 1,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${accentProgress * 100}%`,
                      height: "100%",
                      background: `linear-gradient(90deg, transparent 0%, ${theme.primary} 50%, transparent 100%)`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
