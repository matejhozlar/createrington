import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { Background } from "../components/Background";
import { AnimatedCounter } from "../components/AnimatedCounter";
import { PortalTile } from "../components/PortalTile";

const PACKS = [
  {
    name: "YUNG's",
    modCount: 10,
    topMods: [
      "YUNG's Better Mineshafts",
      "YUNG's Better Dungeons",
      "YUNG's Better Strongholds",
    ],
    weight: 4.20,
    boosts: 31,
    probability: 42,
    tint: theme.primary,
    leading: true,
  },
  {
    name: "Cities",
    modCount: 5,
    topMods: ["Big Lost City", "The Lost City", "Abandoned Urban Remaster"],
    weight: 2.45,
    boosts: 18,
    probability: 25,
    tint: theme.chart.purple,
  },
  {
    name: "Vanilla Revive",
    modCount: 5,
    topMods: ["Yeehaw Towns!", "Adventure Dungeons", "Explorify"],
    weight: 1.80,
    boosts: 12,
    probability: 18,
    tint: theme.chart.blue,
  },
  {
    name: "Vanilla +",
    modCount: 3,
    topMods: [
      "Dungeons and Taverns",
      "ChoiceTheorem's Overhauled Village",
      "Lithostitched",
    ],
    weight: 0.95,
    boosts: 6,
    probability: 10,
    tint: theme.chart.green,
  },
  {
    name: "Mo",
    modCount: 2,
    topMods: ["Mo' Structures", "Omega Config"],
    weight: 0.50,
    boosts: 3,
    probability: 5,
    tint: theme.destructive,
  },
];

const iconBase = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

const BlocksIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...iconBase}>
    <rect x="14" y="14" width="7" height="7" rx="1" />
    <path d="M3 3h7v7H3z" />
    <path d="M14 3h3a4 4 0 0 1 4 4v3" />
    <path d="M10 21H7a4 4 0 0 1-4-4v-3" />
  </svg>
);

const RocketIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...iconBase}>
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
    <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
    <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
  </svg>
);

const TrendingUpIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...iconBase}>
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
    <polyline points="16 7 22 7 22 13" />
  </svg>
);

const PackageIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...iconBase}>
    <path d="M16.5 9.4 7.55 4.24" />
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.29 7 12 12 20.71 7" />
    <line x1="12" y1="22" x2="12" y2="12" />
  </svg>
);

const ClockIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...iconBase}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);


const OBSIDIAN_SVG = `<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' shape-rendering='crispEdges'>
<rect width='16' height='16' fill='#0a0612'/>
<rect x='0' y='0' width='16' height='1' fill='#120a1f'/>
<rect x='2' y='1' width='1' height='1' fill='#1c1233'/>
<rect x='6' y='0' width='1' height='1' fill='#261844'/>
<rect x='11' y='1' width='2' height='1' fill='#1a1030'/>
<rect x='14' y='0' width='1' height='1' fill='#2c1c4a'/>
<rect x='1' y='3' width='1' height='1' fill='#24154a'/>
<rect x='4' y='4' width='2' height='1' fill='#180e2b'/>
<rect x='8' y='3' width='1' height='1' fill='#301e55'/>
<rect x='12' y='4' width='1' height='1' fill='#1c1034'/>
<rect x='0' y='6' width='1' height='1' fill='#2a1848'/>
<rect x='3' y='6' width='1' height='1' fill='#14091f'/>
<rect x='6' y='7' width='2' height='1' fill='#281a48'/>
<rect x='10' y='6' width='1' height='1' fill='#180e2a'/>
<rect x='14' y='7' width='1' height='1' fill='#241640'/>
<rect x='2' y='9' width='1' height='1' fill='#1e1238'/>
<rect x='5' y='9' width='1' height='1' fill='#30205a'/>
<rect x='9' y='10' width='2' height='1' fill='#1a1030'/>
<rect x='13' y='10' width='1' height='1' fill='#241640'/>
<rect x='0' y='12' width='2' height='1' fill='#180e2b'/>
<rect x='4' y='12' width='1' height='1' fill='#2e1e52'/>
<rect x='7' y='12' width='1' height='1' fill='#1c1236'/>
<rect x='11' y='13' width='1' height='1' fill='#281a48'/>
<rect x='3' y='14' width='1' height='1' fill='#241640'/>
<rect x='8' y='14' width='2' height='1' fill='#180e2a'/>
<rect x='13' y='14' width='1' height='1' fill='#1e1236'/>
<rect x='0' y='15' width='16' height='1' fill='#06030b'/>
</svg>`;
const OBSIDIAN_URI = `url("data:image/svg+xml;utf8,${encodeURIComponent(OBSIDIAN_SVG)}")`;

const ObsidianBlock: React.FC<{ size: number }> = ({ size }) => (
  <div
    style={{
      width: size,
      height: size,
      backgroundImage: OBSIDIAN_URI,
      backgroundSize: `${size}px ${size}px`,
      backgroundRepeat: "no-repeat",
      imageRendering: "pixelated",
      boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.035)",
    }}
  />
);

const Portal: React.FC<{ progress: number }> = ({ progress }) => {
  const frame = useCurrentFrame();
  const breath = 0.55 + ((Math.sin(frame / 9) + 1) / 2) * 0.45;

  const blockSize = 96;
  const cols = 4;
  const rows = 5;
  const outerW = cols * blockSize;
  const outerH = rows * blockSize;

  const interiorX = blockSize;
  const interiorY = blockSize;
  const interiorW = blockSize * 2;
  const interiorH = blockSize * 3;

  return (
    <div
      style={{
        position: "relative",
        width: outerW,
        height: outerH,
        transform: `scale(${progress})`,
        opacity: progress,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: -40,
          background: `radial-gradient(ellipse at center, rgba(168, 85, 247, ${0.4 * breath}) 0%, transparent 60%)`,
          filter: "blur(20px)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, ${blockSize}px)`,
          gridTemplateRows: `repeat(${rows}, ${blockSize}px)`,
        }}
      >
        {Array.from({ length: rows * cols }).map((_, i) => {
          const row = Math.floor(i / cols);
          const col = i % cols;
          const isInterior = row >= 1 && row <= 3 && col >= 1 && col <= 2;
          if (isInterior) return <div key={i} />;
          return <ObsidianBlock key={i} size={blockSize} />;
        })}
      </div>

      <div
        style={{
          position: "absolute",
          top: interiorY,
          left: interiorX,
          width: interiorW,
          height: interiorH,
          overflow: "hidden",
          boxShadow: `inset 0 0 60px rgba(168, 85, 247, ${0.55 * breath}), inset 0 0 0 1px rgba(200, 180, 255, 0.25)`,
        }}
      >
        <PortalTile width={interiorW} height={interiorH} tileSize={blockSize} />
      </div>

      <div
        style={{
          position: "absolute",
          inset: 0,
          boxShadow: `0 0 80px rgba(168, 85, 247, ${0.35 * breath}), 0 30px 80px rgba(0,0,0,0.7)`,
          pointerEvents: "none",
        }}
      />
    </div>
  );
};

type Pack = (typeof PACKS)[number];

const PackCard: React.FC<{ pack: Pack; delay: number }> = ({ pack, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cardIn = spring({ frame: frame - delay, fps, config: { damping: 18, stiffness: 100 } });
  const barProgress = interpolate(
    frame,
    [delay + 8, delay + 42],
    [0, pack.probability / 100],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const pctColor = pack.leading ? theme.primary : theme.foreground;

  return (
    <div
      style={{
        background: pack.leading ? "rgba(245, 185, 33, 0.05)" : "rgba(30, 28, 35, 0.85)",
        border: `1px solid ${pack.leading ? `${theme.primary}55` : theme.border}`,
        borderRadius: 14,
        padding: "14px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        opacity: cardIn,
        transform: `translateX(${(1 - cardIn) * -40}px)`,
        boxShadow: pack.leading ? `0 0 40px ${theme.primaryGlow}` : "0 8px 24px rgba(0,0,0,0.35)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: theme.foreground,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {pack.name}
            </div>
            {pack.leading && (
              <div
                style={{
                  padding: "1px 8px",
                  borderRadius: 5,
                  background: theme.primary,
                  color: theme.backgroundDeep,
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                }}
              >
                Leading
              </div>
            )}
          </div>
          <div
            style={{
              fontSize: 12,
              color: theme.mutedForeground,
              marginTop: 4,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {pack.topMods.slice(0, 3).join(" · ")}
          </div>
        </div>
        <div style={{ textAlign: "right", minWidth: 64 }}>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: pctColor,
              fontFamily: theme.fontMono,
              lineHeight: 1,
            }}
          >
            <AnimatedCounter to={pack.probability} durationInFrames={26} delay={delay + 4} suffix="%" />
          </div>
          <div
            style={{
              fontSize: 9,
              color: theme.mutedForeground,
              textTransform: "uppercase",
              letterSpacing: 1.2,
              marginTop: 2,
            }}
          >
            Chance
          </div>
        </div>
      </div>

      <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
        <div
          style={{
            width: `${Math.min(100, barProgress * 100)}%`,
            height: "100%",
            background: pack.tint,
            borderRadius: 2,
            boxShadow: `0 0 8px ${pack.tint}`,
          }}
        />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          fontSize: 12,
          color: theme.mutedForeground,
          fontFamily: theme.fontMono,
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <BlocksIcon size={12} /> {pack.modCount} mod{pack.modCount !== 1 ? "s" : ""}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <RocketIcon size={12} /> {pack.boosts} boost{pack.boosts !== 1 ? "s" : ""}
        </span>
        {pack.leading && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              color: theme.primary,
            }}
          >
            <TrendingUpIcon size={12} /> trending
          </span>
        )}
        <span style={{ marginLeft: "auto", fontFamily: theme.fontMono }}>
          w: {pack.weight.toFixed(2)}
        </span>
      </div>
    </div>
  );
};

export const StructurePacks: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 16], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [168, 192], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const headerIn = spring({ frame, fps, config: { damping: 18, stiffness: 100 } });
  const portalIn = spring({ frame: frame - 24, fps, config: { damping: 18, stiffness: 80 } });
  const countdownPulse = (Math.sin(frame / 10) + 1) / 2;

  return (
    <AbsoluteFill style={{ opacity: fadeIn * fadeOut }}>
      <Background
        image="assets/hero/dark-warehouse.webp"
        zoom={[1.03, 1.07]}
        blur={22}
        darken={0.86}
        gradient="none"
        durationInFrames={194}
      />

      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 65% 55%, rgba(107, 33, 168, 0.25) 0%, transparent 55%)",
          pointerEvents: "none",
        }}
      />

      <AbsoluteFill style={{ padding: "70px 100px" }}>
        <div
          style={{
            opacity: headerIn,
            transform: `translateY(${(1 - headerIn) * 20}px)`,
            maxWidth: 1100,
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
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <PackageIcon size={18} />
            Structure Packs · Parallel Worlds by Agent772
          </div>
          <h2
            style={{
              fontSize: 70,
              fontWeight: 700,
              color: theme.foreground,
              letterSpacing: -2,
              margin: 0,
              lineHeight: 1.05,
            }}
          >
            Shape the <span style={{ color: theme.primary }}>next world</span>.
          </h2>
          <div
            style={{
              marginTop: 14,
              fontSize: 22,
              color: theme.mutedForeground,
            }}
          >
            Temporary mining dimensions rotate on a schedule. Spend in-game
            currency to boost the themed pack you want next — weighted voting
            decides the winner.
          </div>
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            marginTop: 28,
            display: "grid",
            gridTemplateColumns: "1.1fr 1fr",
            gap: 40,
            alignItems: "stretch",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {PACKS.map((p, i) => (
              <PackCard key={p.name} pack={p} delay={22 + i * 9} />
            ))}
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 20,
            }}
          >
            <Portal progress={portalIn} />

            <div
              style={{
                textAlign: "center",
                opacity: portalIn,
                transform: `translateY(${(1 - portalIn) * 16}px)`,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: theme.mutedForeground,
                  textTransform: "uppercase",
                  letterSpacing: 3,
                  marginBottom: 8,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <ClockIcon size={12} />
                Next rotation in
              </div>
              <div
                style={{
                  fontSize: 38,
                  fontFamily: theme.fontMono,
                  fontWeight: 800,
                  color: theme.foreground,
                  letterSpacing: 2,
                  display: "flex",
                  gap: 14,
                  justifyContent: "center",
                }}
              >
                <span style={{ opacity: 0.6 + countdownPulse * 0.4 }}>02d</span>
                <span>14h</span>
                <span>32m</span>
              </div>
            </div>

            <div
              style={{
                fontSize: 12,
                color: theme.mutedForeground,
                fontFamily: theme.fontMono,
                opacity: portalIn * 0.7,
              }}
            >
              Powered by Parallel Worlds by Agent772 · NeoForge 1.21.1
            </div>
          </div>
        </div>

      </AbsoluteFill>
    </AbsoluteFill>
  );
};
