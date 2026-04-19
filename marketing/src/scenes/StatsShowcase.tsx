import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { Background } from "../components/Background";

// Numbers are deliberately approximated ("100+", "10k+") so the video
// doesn't drift when the real numbers move. If we ever re-render on a
// schedule, swap to a pre-render fetch via delayRender()/continueRender().
// See packages/client/src/pages/Home/Home.tsx "Join a Thriving Community"
// — same icon set, same layout conventions.
const STATS = [
  {
    icon: "users",
    value: "100+",
    title: "Registered Members",
    description: "Verified community members",
  },
  {
    icon: "clock",
    value: "10k+",
    title: "Hours Played",
    description: "Total playtime across all players",
  },
  {
    icon: "package",
    value: "200+",
    title: "Curated Mods",
    description: "Hand-picked for balance and performance",
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
  return (
    <svg viewBox="0 0 24 24" {...common}>
      <path d="M16.5 9.4 7.55 4.24" />
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.29 7 12 12 20.71 7" />
      <line x1="12" y1="22" x2="12" y2="12" />
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
        {/* Heading — matches homepage copy 1:1 */}
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
            marginTop: 16,
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

        {/* Three-up grid — mirrors homepage md:grid-cols-3 gap-6 */}
        <div
          style={{
            marginTop: 72,
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 24,
            width: "100%",
            maxWidth: 1440,
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
                key={s.title}
                style={{
                  background: theme.backgroundDeep,
                  border: `1px solid ${theme.border}`,
                  borderRadius: 20,
                  padding: "48px 32px",
                  textAlign: "center",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 16,
                  opacity: cardIn,
                  transform: `translateY(${(1 - cardIn) * 40}px) scale(${0.96 + cardIn * 0.04})`,
                  boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
                }}
              >
                {/* Round icon badge — bg-primary/10, text-primary, w-16 h-16 */}
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: "50%",
                    background: theme.primarySoft,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: theme.primary,
                  }}
                >
                  <Icon kind={s.icon} size={32} />
                </div>

                {/* Value — text-5xl font-bold */}
                <div
                  style={{
                    fontSize: 72,
                    fontWeight: 700,
                    color: theme.foreground,
                    lineHeight: 1,
                    letterSpacing: -2,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {s.value}
                </div>

                {/* Title — text-xl */}
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 600,
                    color: theme.foreground,
                  }}
                >
                  {s.title}
                </div>

                {/* Description — text-base text-muted-foreground */}
                <div
                  style={{
                    fontSize: 18,
                    color: theme.mutedForeground,
                    lineHeight: 1.4,
                  }}
                >
                  {s.description}
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
