import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { Background } from "../components/Background";
import { AnimatedCounter } from "../components/AnimatedCounter";
import { PortalTile } from "../components/PortalTile";

// Modeled after packages/client/src/features/structure-packs/components/PackCard.tsx:
// each pack is a themed bundle of world-gen mods applied to the next
// Parallel Worlds dimension rotation. Players spend in-game currency to
// "boost" their favorite pack; weight → probability it wins.
const PACKS = [
  {
    name: "Ancient Ruins",
    description: "Lost temples, desert cities, forgotten libraries.",
    mods: 12,
    weight: 4.25,
    boosts: 31,
    probability: 42,
    tint: theme.primary,
    active: true,
  },
  {
    name: "Deep Dark Expedition",
    description: "Reinforced deep-dark with ancient city variants.",
    mods: 9,
    weight: 2.80,
    boosts: 18,
    probability: 28,
    tint: theme.chart.purple,
  },
  {
    name: "Arctic Wastes",
    description: "Frozen tundra biomes with ruined outposts.",
    mods: 7,
    weight: 1.95,
    boosts: 12,
    probability: 19,
    tint: theme.chart.blue,
  },
  {
    name: "Nether Gateway",
    description: "High-density nether variants and rare loot.",
    mods: 8,
    weight: 1.10,
    boosts: 6,
    probability: 11,
    tint: theme.destructive,
  },
];

const CAPABILITIES = [
  "Seed rotates on schedule",
  "Cloned from your server's worldgen",
  "Auto map-mod cleanup",
  "Pre-generated, TPS-aware",
];

// Faithful Parallel Worlds portal: a 4×5 block glass frame wrapping a 2×3
// interior that plays the actual pw_portal.png atlas with the mod's
// animation metadata (16 frames · frametime 3 · interpolate true).
//
// The mod's default ignition block is glass (configurable per server), so
// the frame mimics a pixel-art glass block — transparent panes with the
// characteristic vanilla glass edge highlights.
// Small "asset card" framing a real mod texture with its resource name below.
const AssetSwatch: React.FC<{
  label: string;
  contents: React.ReactNode;
  rotate?: number;
}> = ({ label, contents, rotate = 0 }) => (
  <div
    style={{
      width: 96,
      borderRadius: 10,
      border: `1px solid ${theme.border}`,
      background: theme.card,
      padding: 8,
      transform: `rotate(${rotate}deg)`,
      boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 4,
    }}
  >
    <div
      style={{
        width: 72,
        height: 72,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {contents}
    </div>
    <div
      style={{
        fontSize: 9,
        color: theme.mutedForeground,
        fontFamily: theme.fontMono,
        letterSpacing: 1,
        textTransform: "uppercase",
      }}
    >
      {label}
    </div>
  </div>
);

// 16×16 pixel-art obsidian tile encoded as an inline SVG data URI. Classic
// vanilla palette — near-black base with scattered deep-purple specks,
// rendered crisply via shape-rendering="crispEdges".
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

// Obsidian portal-frame block. Tiles the SVG at 1:1 to the cell size;
// imageRendering: pixelated keeps edges crisp when scaled.
const ObsidianBlock: React.FC<{ size: number }> = ({ size }) => (
  <div
    style={{
      width: size,
      height: size,
      backgroundImage: OBSIDIAN_URI,
      backgroundSize: `${size}px ${size}px`,
      backgroundRepeat: "no-repeat",
      imageRendering: "pixelated",
      boxShadow:
        "inset 0 0 0 1px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.035)",
    }}
  />
);

const Portal: React.FC<{ progress: number }> = ({ progress }) => {
  const frame = useCurrentFrame();
  const breath = 0.55 + ((Math.sin(frame / 9) + 1) / 2) * 0.45;

  // Standard nether-portal dimensions in blocks: 4 wide × 5 tall outer,
  // 2 × 3 inner. We render at blockSize pixels per block.
  const blockSize = 96;
  const cols = 4;
  const rows = 5;
  const outerW = cols * blockSize;
  const outerH = rows * blockSize;

  // Interior: 2×3 blocks, offset by 1 block in both axes.
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
      {/* Outer amber aura around the whole gate */}
      <div
        style={{
          position: "absolute",
          inset: -40,
          background: `radial-gradient(ellipse at center, rgba(168, 85, 247, ${0.4 * breath}) 0%, transparent 60%)`,
          filter: "blur(20px)",
          pointerEvents: "none",
        }}
      />

      {/* 4×5 grid of obsidian frame blocks (skip interior cells) */}
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

      {/* Portal interior — single seamless animated face across the full
          2×3 opening (no inter-block seams). The 16×16 source stretches to
          fill, which matches how adjacent portal blocks read as one surface
          in-game. */}
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
        <PortalTile width={interiorW} height={interiorH} />
      </div>

      {/* Additional outer glow ring */}
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

      {/* Ambient purple wash to hint at the portal dimension */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 65% 55%, rgba(107, 33, 168, 0.25) 0%, transparent 55%)",
          pointerEvents: "none",
        }}
      />

      <AbsoluteFill style={{ padding: "70px 100px" }}>
        {/* Header */}
        <div
          style={{
            opacity: headerIn,
            transform: `translateY(${(1 - headerIn) * 20}px)`,
            maxWidth: 1000,
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
            Structure Packs · Parallel Worlds
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

        {/* Body: cards (left) + portal (right) */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            marginTop: 32,
            display: "grid",
            gridTemplateColumns: "1.1fr 1fr",
            gap: 40,
            alignItems: "stretch",
          }}
        >
          {/* Pack cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {PACKS.map((p, i) => {
              const delay = 22 + i * 10;
              const cardIn = spring({
                frame: frame - delay,
                fps,
                config: { damping: 18, stiffness: 100 },
              });
              const barProgress = interpolate(
                frame,
                [delay + 8, delay + 44],
                [0, p.probability / 60], // max bar ≈ 70%
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
              );
              return (
                <div
                  key={p.name}
                  style={{
                    background: p.active
                      ? "rgba(245, 185, 33, 0.06)"
                      : "rgba(30, 28, 35, 0.85)",
                    border: `1px solid ${p.active ? `${theme.primary}55` : theme.border}`,
                    borderRadius: 16,
                    padding: "18px 22px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    opacity: cardIn,
                    transform: `translateX(${(1 - cardIn) * -40}px)`,
                    boxShadow: p.active
                      ? `0 0 40px ${theme.primaryGlow}`
                      : "0 10px 30px rgba(0,0,0,0.35)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 16,
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          marginBottom: 4,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 22,
                            fontWeight: 700,
                            color: theme.foreground,
                          }}
                        >
                          {p.name}
                        </div>
                        {p.active && (
                          <div
                            style={{
                              padding: "2px 10px",
                              borderRadius: 6,
                              background: theme.primary,
                              color: theme.backgroundDeep,
                              fontSize: 11,
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
                          fontSize: 14,
                          color: theme.mutedForeground,
                          lineHeight: 1.4,
                        }}
                      >
                        {p.description}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", minWidth: 80 }}>
                      <div
                        style={{
                          fontSize: 28,
                          fontWeight: 800,
                          color: p.active ? theme.primary : theme.foreground,
                          fontFamily: theme.fontMono,
                          lineHeight: 1,
                        }}
                      >
                        <AnimatedCounter
                          to={p.probability}
                          durationInFrames={30}
                          delay={delay + 6}
                          suffix="%"
                        />
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: theme.mutedForeground,
                          textTransform: "uppercase",
                          letterSpacing: 1.5,
                          marginTop: 2,
                        }}
                      >
                        Chance
                      </div>
                    </div>
                  </div>

                  {/* Weight bar */}
                  <div
                    style={{
                      height: 5,
                      borderRadius: 3,
                      background: "rgba(255,255,255,0.06)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.min(100, barProgress * 100)}%`,
                        height: "100%",
                        background: p.tint,
                        borderRadius: 3,
                        boxShadow: `0 0 8px ${p.tint}`,
                      }}
                    />
                  </div>

                  {/* Meta row */}
                  <div
                    style={{
                      display: "flex",
                      gap: 20,
                      fontSize: 13,
                      color: theme.mutedForeground,
                      fontFamily: theme.fontMono,
                    }}
                  >
                    <span>{p.mods} mods</span>
                    <span>{p.boosts} boosts</span>
                    <span style={{ marginLeft: "auto" }}>w: {p.weight.toFixed(2)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Portal + context */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 24,
              position: "relative",
            }}
          >
            {/* Floating mod-asset callouts: real animated portal tile + item */}
            <div
              style={{
                position: "absolute",
                top: 6,
                right: 10,
                display: "flex",
                flexDirection: "column",
                gap: 10,
                opacity: portalIn * 0.9,
                transform: `translateY(${(1 - portalIn) * -20}px)`,
              }}
            >
              <AssetSwatch
                label="pw_portal"
                rotate={6}
                contents={<PortalTile width={72} />}
              />
              <AssetSwatch
                label="death_recall_token"
                rotate={-6}
                contents={
                  <Img
                    src={staticFile("assets/parallel-worlds/death_recall_token.png")}
                    style={{
                      width: 72,
                      height: 72,
                      imageRendering: "pixelated",
                      objectFit: "contain",
                    }}
                  />
                }
              />
            </div>

            <Portal progress={portalIn} />

            {/* Countdown */}
            <div
              style={{
                textAlign: "center",
                opacity: portalIn,
                transform: `translateY(${(1 - portalIn) * 16}px)`,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  color: theme.mutedForeground,
                  textTransform: "uppercase",
                  letterSpacing: 3,
                  marginBottom: 8,
                }}
              >
                Next rotation in
              </div>
              <div
                style={{
                  fontSize: 40,
                  fontFamily: theme.fontMono,
                  fontWeight: 800,
                  color: theme.foreground,
                  letterSpacing: 2,
                  display: "flex",
                  gap: 16,
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
                fontSize: 13,
                color: theme.mutedForeground,
                fontFamily: theme.fontMono,
                opacity: portalIn * 0.7,
              }}
            >
              Powered by Parallel Worlds · NeoForge 1.21.1
            </div>
          </div>
        </div>

        {/* Capability chips */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 10,
            flexWrap: "wrap",
            marginTop: 18,
          }}
        >
          {CAPABILITIES.map((c, i) => {
            const t = spring({
              frame: frame - (80 + i * 6),
              fps,
              config: { damping: 20, stiffness: 90 },
            });
            return (
              <div
                key={c}
                style={{
                  padding: "8px 16px",
                  borderRadius: 999,
                  background: "rgba(30, 28, 35, 0.85)",
                  border: `1px solid ${theme.border}`,
                  color: theme.foreground,
                  fontSize: 14,
                  fontWeight: 500,
                  opacity: t,
                  transform: `translateY(${(1 - t) * 8}px)`,
                }}
              >
                {c}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
