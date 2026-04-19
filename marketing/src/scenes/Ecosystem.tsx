import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { Background } from "../components/Background";
import { LOGOS } from "../components/assets";

type NodeSpec = {
  key: string;
  label: string;
  sub: string;
  color: string;
  x: number;
  y: number;
  logo: string;
};

const NODES: NodeSpec[] = [
  { key: "mc", label: "Minecraft", sub: "Create · 1.21.1", color: "#6aaa48", x: 280, y: 560, logo: LOGOS.cogsAndSteam },
  { key: "web", label: "Web Portal", sub: "createrington.com", color: theme.primary, x: 960, y: 240, logo: LOGOS.createrington },
  { key: "discord", label: "Discord", sub: "OAuth · Bots", color: theme.discord, x: 1640, y: 560, logo: LOGOS.discord },
];

const CENTER = { x: 960, y: 560 };

const CAPABILITIES = [
  { label: "Real-time chat bridge", color: theme.primary },
  { label: "Discord OAuth verification", color: theme.discord },
  { label: "Auto role assignment", color: theme.chart.green },
  { label: "Live player tracking", color: theme.chart.blue },
];

export const Ecosystem: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [168, 192], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const headerIn = spring({ frame, fps, config: { damping: 18, stiffness: 100 } });

  return (
    <AbsoluteFill style={{ opacity: fadeIn * fadeOut }}>
      <Background
        image="assets/hero/dark-warehouse.webp"
        zoom={[1.05, 1.12]}
        blur={18}
        darken={0.85}
        gradient="none"
        durationInFrames={194}
      />

      <AbsoluteFill style={{ padding: "70px 100px" }}>
        <div
          style={{
            opacity: headerIn,
            transform: `translateY(${(1 - headerIn) * 20}px)`,
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 22,
              letterSpacing: 8,
              color: theme.primary,
              fontWeight: 600,
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            One Unified Platform
          </div>
          <h2
            style={{
              fontSize: 72,
              fontWeight: 700,
              color: theme.foreground,
              letterSpacing: -2,
              margin: 0,
            }}
          >
            Three worlds. <span style={{ color: theme.primary }}>One identity</span>.
          </h2>
          <div
            style={{
              marginTop: 14,
              fontSize: 22,
              color: theme.mutedForeground,
              maxWidth: 1100,
              margin: "14px auto 0",
            }}
          >
            Minecraft · Discord · Web — connected by a type-safe Node.js backend
            with real-time chat, OAuth, and automatic role sync.
          </div>
        </div>

        <div style={{ position: "relative", flex: 1, marginTop: 20, minHeight: 0 }}>
          <svg
            viewBox="0 0 1920 840"
            preserveAspectRatio="none"
            style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}
          >
            {/* Connection lines */}
            {NODES.map((n, i) => {
              const appear = spring({
                frame: frame - (30 + i * 8),
                fps,
                config: { damping: 22, stiffness: 80 },
              });
              // Multiple flowing dots
              return (
                <g key={`line-${n.key}`}>
                  <line
                    x1={CENTER.x}
                    y1={CENTER.y}
                    x2={n.x}
                    y2={n.y}
                    stroke={n.color}
                    strokeWidth={2.5}
                    strokeDasharray="8 10"
                    opacity={appear * 0.6}
                  />
                  {[0, 33, 66].map((offset, dotI) => {
                    const flow = ((frame * 1.8 + offset + i * 20) % 100) / 100;
                    return (
                      <circle
                        key={dotI}
                        cx={CENTER.x + (n.x - CENTER.x) * flow}
                        cy={CENTER.y + (n.y - CENTER.y) * flow}
                        r={5}
                        fill={n.color}
                        opacity={appear * (1 - Math.abs(flow - 0.5) * 0.4)}
                      />
                    );
                  })}
                </g>
              );
            })}

            {/* Central hub */}
            <circle
              cx={CENTER.x}
              cy={CENTER.y}
              r={60 + ((Math.sin(frame / 8) + 1) / 2) * 24}
              fill={theme.primary}
              opacity={0.06}
            />
            <circle cx={CENTER.x} cy={CENTER.y} r={36} fill={theme.primary} opacity={0.18} />
            <circle
              cx={CENTER.x}
              cy={CENTER.y}
              r={20}
              fill={theme.primary}
              stroke={theme.backgroundDeep}
              strokeWidth={4}
            />
            <text
              x={CENTER.x}
              y={CENTER.y + 86}
              fontSize={20}
              textAnchor="middle"
              fill={theme.foreground}
              fontFamily={theme.fontSans}
              fontWeight={700}
            >
              tRPC · WebSocket · Postgres
            </text>
          </svg>

          {/* HTML-positioned nodes with REAL logos */}
          {NODES.map((n, i) => {
            const appear = spring({
              frame: frame - (20 + i * 10),
              fps,
              config: { damping: 16, stiffness: 100 },
            });
            const left = `${(n.x / 1920) * 100}%`;
            const top = `${(n.y / 840) * 100}%`;
            return (
              <div
                key={n.key}
                style={{
                  position: "absolute",
                  left,
                  top,
                  transform: `translate(-50%, -50%) scale(${appear})`,
                  opacity: appear,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 14,
                }}
              >
                <div
                  style={{
                    width: 160,
                    height: 160,
                    borderRadius: 32,
                    background: "rgba(30, 28, 35, 0.9)",
                    border: `2px solid ${n.color}`,
                    boxShadow: `0 0 80px ${n.color}55, 0 20px 50px rgba(0,0,0,0.5)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 24,
                    overflow: "hidden",
                  }}
                >
                  <Img
                    src={staticFile(n.logo)}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                    }}
                  />
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 26, fontWeight: 700, color: theme.foreground }}>
                    {n.label}
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      color: theme.mutedForeground,
                      fontFamily: theme.fontMono,
                      marginTop: 2,
                    }}
                  >
                    {n.sub}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Capability chips at bottom */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 12,
            flexWrap: "wrap",
            marginTop: 10,
          }}
        >
          {CAPABILITIES.map((c, i) => {
            const t = spring({
              frame: frame - (60 + i * 6),
              fps,
              config: { damping: 20, stiffness: 90 },
            });
            return (
              <div
                key={c.label}
                style={{
                  padding: "10px 18px",
                  borderRadius: 999,
                  background: "rgba(30, 28, 35, 0.85)",
                  border: `1px solid ${c.color}55`,
                  color: theme.foreground,
                  fontSize: 15,
                  fontWeight: 500,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  opacity: t,
                  transform: `translateY(${(1 - t) * 10}px)`,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: c.color,
                    boxShadow: `0 0 8px ${c.color}`,
                  }}
                />
                {c.label}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
