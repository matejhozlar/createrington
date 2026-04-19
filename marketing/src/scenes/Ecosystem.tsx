import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { Background } from "../components/Background";
import { LOGOS } from "../components/assets";

type NodeSpec = {
  key: string;
  label: string;
  sub: string;
  color: string;
  angleDeg: number;
  render: "image" | "globe";
  logo?: string;
};

const CENTER = { x: 960, y: 460 };
const ORBIT_R = 320;

const NODES: NodeSpec[] = [
  { key: "web",     label: "Web Portal", sub: "createrington.com", color: theme.primary, angleDeg: -90,  render: "globe" },
  { key: "discord", label: "Discord",    sub: "Chat · Community",  color: theme.discord, angleDeg: 30,   render: "image", logo: LOGOS.discord },
  { key: "mc",      label: "Minecraft",  sub: "Create · 1.21.1",   color: "#6aaa48",     angleDeg: 150,  render: "image", logo: LOGOS.cogsAndSteam },
];

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

type NodePosition = { x: number; y: number; scale: number; opacity: number };

const polar = (angleDeg: number, r: number) => {
  const a = (angleDeg * Math.PI) / 180;
  return { x: CENTER.x + Math.cos(a) * r, y: CENTER.y + Math.sin(a) * r };
};

const ORBIT_DRIFT_PER_FRAME = 0.08;

export const Ecosystem: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [168, 192], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const headerIn = spring({ frame, fps, config: { damping: 18, stiffness: 100 } });
  const coreIn = spring({ frame: frame - 10, fps, config: { damping: 14, stiffness: 90 } });
  const coreBreath = 0.6 + ((Math.sin(frame / 14) + 1) / 2) * 0.4;

  const nodePositions: Record<string, NodePosition> = {};
  const ENTER_DURATION = 34;
  NODES.forEach((n, i) => {
    const delay = 30 + i * 9;
    const t = interpolate(frame, [delay, delay + ENTER_DURATION], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.22, 1, 0.36, 1),
    });
    const rAtT = interpolate(t, [0, 1], [ORBIT_R * 2.3, ORBIT_R]);
    const angleOffsetAtT = interpolate(t, [0, 1], [40, 0]);
    const driftFrames = Math.max(0, frame - (delay + ENTER_DURATION));
    const finalAngle = n.angleDeg + driftFrames * ORBIT_DRIFT_PER_FRAME;
    const pos = polar(finalAngle + angleOffsetAtT, rAtT);
    nodePositions[n.key] = { x: pos.x, y: pos.y, scale: 0.5 + t * 0.5, opacity: t };
  });

  const lineProgressFor = (i: number) =>
    interpolate(frame, [60 + i * 6, 90 + i * 6], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

  return (
    <AbsoluteFill style={{ opacity: fadeIn * fadeOut }}>
      <Background
        image="assets/hero/dark-warehouse.webp"
        zoom={[1.04, 1.1]}
        blur={26}
        darken={0.9}
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
            Log in once. Your balance, playtime, and conversations follow
            you between the server, the chat, and the web — automatically.
          </div>
        </div>

        <div style={{ position: "relative", flex: 1, marginTop: 24, minHeight: 0 }}>
          <svg
            viewBox="0 0 1920 920"
            preserveAspectRatio="none"
            style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}
          >
            {[0, 1, 2].map((i) => {
              const cycle = 84;
              const phase = (frame + i * (cycle / 3)) % cycle;
              const progress = phase / cycle;
              const r = 100 + progress * (ORBIT_R + 80);
              const op = (1 - progress) * 0.32 * coreIn;
              return (
                <circle
                  key={`wave-${i}`}
                  cx={CENTER.x}
                  cy={CENTER.y}
                  r={r}
                  fill="none"
                  stroke={theme.primary}
                  strokeWidth={1.5}
                  opacity={op}
                />
              );
            })}

            <circle
              cx={CENTER.x}
              cy={CENTER.y}
              r={ORBIT_R}
              fill="none"
              stroke={theme.primary}
              strokeWidth={1}
              strokeDasharray="2 10"
              opacity={coreIn * 0.22}
            />

            <circle
              cx={CENTER.x}
              cy={CENTER.y}
              r={112}
              fill="none"
              stroke={theme.primary}
              strokeWidth={1.5}
              strokeDasharray="4 12"
              opacity={coreIn * 0.6}
              transform={`rotate(${frame * 0.6} ${CENTER.x} ${CENTER.y})`}
            />
            <circle
              cx={CENTER.x}
              cy={CENTER.y}
              r={96}
              fill="none"
              stroke={theme.primary}
              strokeWidth={1}
              strokeDasharray="2 8"
              opacity={coreIn * 0.4}
              transform={`rotate(${-frame * 0.9} ${CENTER.x} ${CENTER.y})`}
            />
            <circle
              cx={CENTER.x}
              cy={CENTER.y}
              r={82 + coreBreath * 10}
              fill={theme.primary}
              opacity={0.1 * coreIn}
            />

            {NODES.map((n, i) => {
              const pos = nodePositions[n.key]!;
              const lineT = lineProgressFor(i);
              const visualProgress = lineT * (pos.opacity > 0.6 ? 1 : 0);
              const x2 = CENTER.x + (pos.x - CENTER.x) * visualProgress;
              const y2 = CENTER.y + (pos.y - CENTER.y) * visualProgress;
              return (
                <g key={`line-${n.key}`}>
                  <line
                    x1={CENTER.x}
                    y1={CENTER.y}
                    x2={x2}
                    y2={y2}
                    stroke={n.color}
                    strokeWidth={2.5}
                    strokeDasharray="8 10"
                    opacity={0.6}
                  />
                  {visualProgress > 0.95 &&
                    [0, 33, 66].map((offset, dotI) => {
                      const flow = ((frame * 1.8 + offset + i * 20) % 100) / 100;
                      return (
                        <circle
                          key={dotI}
                          cx={CENTER.x + (pos.x - CENTER.x) * flow}
                          cy={CENTER.y + (pos.y - CENTER.y) * flow}
                          r={5}
                          fill={n.color}
                          opacity={1 - Math.abs(flow - 0.5) * 0.4}
                        />
                      );
                    })}
                </g>
              );
            })}
          </svg>

          <Img
            src={staticFile("assets/logo/logo.webp")}
            style={{
              position: "absolute",
              left: `${(CENTER.x / 1920) * 100}%`,
              top: `${(CENTER.y / 920) * 100}%`,
              width: 200,
              height: 200,
              objectFit: "contain",
              transform: `translate(-50%, -50%) scale(${0.6 + coreIn * 0.4})`,
              opacity: coreIn,
              filter: `drop-shadow(0 0 ${40 + coreBreath * 30}px ${theme.primaryGlow}) drop-shadow(0 16px 50px rgba(0,0,0,0.6))`,
            }}
          />

          {NODES.map((n) => {
            const pos = nodePositions[n.key]!;
            return (
              <div
                key={n.key}
                style={{
                  position: "absolute",
                  left: `${(pos.x / 1920) * 100}%`,
                  top: `${(pos.y / 920) * 100}%`,
                  transform: `translate(-50%, -50%) scale(${pos.scale})`,
                  opacity: pos.opacity,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 14,
                }}
              >
                <div
                  style={{
                    width: 148,
                    height: 148,
                    borderRadius: "50%",
                    background: "rgba(30, 28, 35, 0.92)",
                    border: `2px solid ${n.color}`,
                    boxShadow: `0 0 70px ${n.color}55, 0 20px 50px rgba(0,0,0,0.5)`,
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
                    <GlobeGlyph size={104} color={n.color} />
                  )}
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: theme.foreground }}>
                    {n.label}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
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
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
