import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { Background } from "../components/Background";
import { LOGOS } from "../components/assets";

type NodeSpec = {
  key: string;
  label: string;
  sub: string;
  protocol: string;           // short label that sits on the connection line
  color: string;
  x: number;
  y: number;
  render: "image" | "globe";  // image = staticFile logo, globe = custom SVG
  logo?: string;              // required when render === "image"
};

// Custom globe SVG for the Web Portal node — the createrington logo now
// lives at the center of the diagram as "the platform", so the Web node
// needs its own distinct visual. A wire-frame globe reads unambiguously
// as "the web" at this size.
const GlobeGlyph: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} style={{ display: "block" }}>
    <circle cx="50" cy="50" r="44" fill="none" stroke={color} strokeWidth={3} />
    <ellipse cx="50" cy="50" rx="44" ry="14" fill="none" stroke={color} strokeWidth={2} />
    <ellipse cx="50" cy="50" rx="14" ry="44" fill="none" stroke={color} strokeWidth={2} />
    <ellipse cx="50" cy="50" rx="38" ry="28" fill="none" stroke={color} strokeWidth={1.5} opacity={0.55} />
    <line x1="6" y1="50" x2="94" y2="50" stroke={color} strokeWidth={1.5} />
    <line x1="50" y1="6" x2="50" y2="94" stroke={color} strokeWidth={1.5} />
  </svg>
);

const NODES: NodeSpec[] = [
  { key: "mc",      label: "Minecraft",  sub: "Create · 1.21.1",   protocol: "Plugin · RCON",    color: "#6aaa48",       x: 280,  y: 560, render: "image", logo: LOGOS.cogsAndSteam },
  { key: "web",     label: "Web Portal", sub: "createrington.com", protocol: "tRPC · HTTPS",     color: theme.primary,   x: 960,  y: 240, render: "globe" },
  { key: "discord", label: "Discord",    sub: "OAuth · Bots",      protocol: "OAuth · Webhooks", color: theme.discord,   x: 1640, y: 560, render: "image", logo: LOGOS.discord },
];

const CENTER = { x: 960, y: 560 };

const CAPABILITIES = [
  { label: "Real-time chat bridge",      color: theme.primary },
  { label: "Discord OAuth verification", color: theme.discord },
  { label: "Auto role assignment",       color: theme.chart.green },
  { label: "Live player tracking",       color: theme.chart.blue },
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
  const coreIn = spring({ frame: frame - 18, fps, config: { damping: 16, stiffness: 90 } });
  const coreBreath = 0.6 + ((Math.sin(frame / 14) + 1) / 2) * 0.4;

  return (
    <AbsoluteFill style={{ opacity: fadeIn * fadeOut }}>
      <Background
        image="assets/hero/dark-warehouse.webp"
        zoom={[1.05, 1.12]}
        blur={22}
        darken={0.9}
        gradient="none"
        durationInFrames={194}
      />

      <AbsoluteFill style={{ padding: "70px 100px" }}>
        {/* Header */}
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

        {/* Diagram */}
        <div style={{ position: "relative", flex: 1, marginTop: 20, minHeight: 0 }}>
          <svg
            viewBox="0 0 1920 840"
            preserveAspectRatio="none"
            style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}
          >
            {/* Broadcasting rings — three staggered, expand + fade */}
            {[0, 1, 2].map((i) => {
              const cycle = 72;                           // frames per pulse
              const phase = (frame + i * (cycle / 3)) % cycle;
              const progress = phase / cycle;
              const r = 120 + progress * 280;
              const ringOpacity = (1 - progress) * 0.35 * coreIn;
              return (
                <circle
                  key={`ring-${i}`}
                  cx={CENTER.x}
                  cy={CENTER.y}
                  r={r}
                  fill="none"
                  stroke={theme.primary}
                  strokeWidth={1.5}
                  opacity={ringOpacity}
                />
              );
            })}

            {/* Connection lines + flowing data dots */}
            {NODES.map((n, i) => {
              const appear = spring({
                frame: frame - (30 + i * 8),
                fps,
                config: { damping: 22, stiffness: 80 },
              });
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

            {/* Rotating dashed ring around the core */}
            <circle
              cx={CENTER.x}
              cy={CENTER.y}
              r={118}
              fill="none"
              stroke={theme.primary}
              strokeWidth={1.5}
              strokeDasharray="4 12"
              opacity={coreIn * 0.55}
              transform={`rotate(${frame * 0.6} ${CENTER.x} ${CENTER.y})`}
            />
            {/* Counter-rotating inner ring */}
            <circle
              cx={CENTER.x}
              cy={CENTER.y}
              r={102}
              fill="none"
              stroke={theme.primary}
              strokeWidth={1}
              strokeDasharray="2 8"
              opacity={coreIn * 0.35}
              transform={`rotate(${-frame * 0.9} ${CENTER.x} ${CENTER.y})`}
            />
            {/* Solid halo underneath the logo plate */}
            <circle
              cx={CENTER.x}
              cy={CENTER.y}
              r={80 + coreBreath * 8}
              fill={theme.primary}
              opacity={0.08 * coreIn}
            />
          </svg>

          {/* Protocol pills — overlaid at the midpoint of each line */}
          {NODES.map((n, i) => {
            const midX = (CENTER.x + n.x) / 2;
            const midY = (CENTER.y + n.y) / 2;
            const appear = spring({
              frame: frame - (40 + i * 8),
              fps,
              config: { damping: 20, stiffness: 90 },
            });
            const left = `${(midX / 1920) * 100}%`;
            const top = `${(midY / 840) * 100}%`;
            return (
              <div
                key={`label-${n.key}`}
                style={{
                  position: "absolute",
                  left,
                  top,
                  transform: `translate(-50%, -50%) scale(${appear})`,
                  opacity: appear,
                  padding: "6px 14px",
                  borderRadius: 999,
                  background: "rgba(15, 14, 18, 0.92)",
                  border: `1px solid ${n.color}66`,
                  color: theme.foreground,
                  fontSize: 13,
                  fontFamily: theme.fontMono,
                  fontWeight: 600,
                  letterSpacing: 0.5,
                  whiteSpace: "nowrap",
                  boxShadow: `0 0 20px ${n.color}33`,
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: n.color,
                    marginRight: 8,
                    verticalAlign: "middle",
                    boxShadow: `0 0 6px ${n.color}`,
                  }}
                />
                {n.protocol}
              </div>
            );
          })}

          {/* Central core — Createrington logo */}
          <div
            style={{
              position: "absolute",
              left: `${(CENTER.x / 1920) * 100}%`,
              top: `${(CENTER.y / 840) * 100}%`,
              transform: `translate(-50%, -50%) scale(${0.7 + coreIn * 0.3})`,
              opacity: coreIn,
            }}
          >
            <div
              style={{
                width: 180,
                height: 180,
                borderRadius: 40,
                background: theme.backgroundDeep,
                border: `2px solid ${theme.primary}`,
                boxShadow: `0 0 ${60 + coreBreath * 40}px ${theme.primaryGlow}, 0 20px 60px rgba(0,0,0,0.6)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 24,
                position: "relative",
              }}
            >
              <Img
                src={staticFile(LOGOS.createrington)}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                }}
              />
            </div>
            {/* "Core" tagline below the logo plate */}
            <div
              style={{
                marginTop: 18,
                textAlign: "center",
                fontSize: 13,
                letterSpacing: 4,
                textTransform: "uppercase",
                color: theme.primary,
                fontFamily: theme.fontMono,
                fontWeight: 700,
              }}
            >
              · Platform Core ·
            </div>
          </div>

          {/* HTML-positioned client nodes */}
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
                    background: "rgba(30, 28, 35, 0.92)",
                    border: `2px solid ${n.color}`,
                    boxShadow: `0 0 80px ${n.color}55, 0 20px 50px rgba(0,0,0,0.5)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: n.render === "globe" ? 22 : 24,
                    overflow: "hidden",
                  }}
                >
                  {n.render === "image" && n.logo ? (
                    <Img
                      src={staticFile(n.logo)}
                      style={{ width: "100%", height: "100%", objectFit: "contain" }}
                    />
                  ) : (
                    <GlobeGlyph size={114} color={n.color} />
                  )}
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

        {/* Capability chips */}
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
