import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { Background } from "../components/Background";

// Hand-picked build shots — the two newest hero images (metro + space
// station) lead, with two of the unused train-station shots filling the
// column. Every tile is a real in-world screenshot.
const BUILDS = [
  {
    image: "assets/hero/metro.webp",
    title: "Underground Metro",
    meta: "Public transit · signal network",
    panX: -40,
    panY: 12,
  },
  {
    image: "assets/hero/space-station.webp",
    title: "Orbital Launch Complex",
    meta: "Spaceport · multi-pad",
    panX: 24,
    panY: 0,
  },
  {
    image: "assets/hero/high-speed-train.webp",
    title: "High-Speed Rail",
    meta: "Long-haul · 200+ km/h",
    panX: -20,
    panY: -8,
  },
  {
    image: "assets/hero/royal-albert-hall.webp",
    title: "Royal Albert Hall",
    meta: "Concert hall · community gathering",
    panX: 14,
    panY: -4,
  },
];

type Build = (typeof BUILDS)[number];

type TileProps = {
  build: Build;
  index: number;          // 0..N-1, for number overlay
  total: number;
  delay: number;
  large?: boolean;
  sceneDuration: number;  // for ken-burns progress math
};

const BuildTile: React.FC<TileProps> = ({ build, index, total, delay, large, sceneDuration }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cardIn = spring({
    frame: frame - delay,
    fps,
    config: { damping: 18, stiffness: 95 },
  });

  // Ken-burns: independent zoom + pan per tile, timed to the whole scene.
  const t = interpolate(frame, [0, sceneDuration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const zoom = interpolate(t, [0, 1], [1.05, 1.16]);
  const tx = build.panX * t;
  const ty = build.panY * t;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        borderRadius: large ? 24 : 16,
        overflow: "hidden",
        border: `1px solid ${theme.border}`,
        boxShadow: large
          ? "0 40px 100px rgba(0,0,0,0.6), 0 0 0 1px rgba(245,185,33,0.06)"
          : "0 20px 60px rgba(0,0,0,0.5)",
        opacity: cardIn,
        transform: `translateY(${(1 - cardIn) * 40}px) scale(${0.96 + cardIn * 0.04})`,
        background: theme.backgroundDeep,
      }}
    >
      {/* Image — ken-burns zoom + pan */}
      <Img
        src={staticFile(build.image)}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${zoom}) translate(${tx}px, ${ty}px)`,
          transformOrigin: "center center",
        }}
      />

      {/* Bottom gradient so text stays readable */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.85) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Top-right index pill — magazine-style "01 / 04" */}
      <div
        style={{
          position: "absolute",
          top: large ? 24 : 14,
          right: large ? 24 : 14,
          padding: large ? "6px 12px" : "4px 9px",
          borderRadius: 999,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(8px)",
          border: `1px solid ${theme.border}`,
          color: theme.foreground,
          fontSize: large ? 13 : 11,
          fontFamily: theme.fontMono,
          letterSpacing: 1.5,
          fontWeight: 600,
        }}
      >
        {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
      </div>

      {/* Caption block */}
      <div
        style={{
          position: "absolute",
          left: large ? 32 : 18,
          right: large ? 32 : 18,
          bottom: large ? 28 : 16,
          color: theme.foreground,
        }}
      >
        {/* Thin amber accent line above title */}
        <div
          style={{
            width: large ? 48 : 28,
            height: 2,
            background: theme.primary,
            marginBottom: large ? 14 : 8,
            borderRadius: 1,
            boxShadow: `0 0 8px ${theme.primaryGlow}`,
            transform: `scaleX(${cardIn})`,
            transformOrigin: "left center",
          }}
        />
        <div
          style={{
            fontSize: large ? 40 : 20,
            fontWeight: 700,
            letterSpacing: -0.5,
            lineHeight: 1.1,
            textShadow: "0 2px 10px rgba(0,0,0,0.7)",
          }}
        >
          {build.title}
        </div>
        <div
          style={{
            marginTop: large ? 8 : 4,
            fontSize: large ? 16 : 12,
            color: "#d2d0d8",
            fontFamily: theme.fontMono,
            letterSpacing: 0.5,
            textShadow: "0 1px 6px rgba(0,0,0,0.8)",
          }}
        >
          {build.meta}
        </div>
      </div>
    </div>
  );
};

export const FeaturedBuilds: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const SCENE = 180;   // scene length in frames, used for ken-burns math

  const fadeIn = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [168, 192], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const headerIn = spring({ frame, fps, config: { damping: 18, stiffness: 100 } });
  const lineGrow = interpolate(frame, [8, 36], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity: fadeIn * fadeOut }}>
      <Background
        image="assets/hero/metro.webp"
        zoom={[1.02, 1.05]}
        blur={28}
        darken={0.88}
        gradient="none"
        durationInFrames={194}
      />

      <AbsoluteFill style={{ padding: "70px 100px 64px" }}>
        {/* Header */}
        <div
          style={{
            opacity: headerIn,
            transform: `translateY(${(1 - headerIn) * 20}px)`,
            marginBottom: 28,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 40,
          }}
        >
          <div>
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
              Featured Builds
            </div>
            <h2
              style={{
                fontSize: 72,
                fontWeight: 700,
                color: theme.foreground,
                letterSpacing: -2,
                margin: 0,
                lineHeight: 1.02,
              }}
            >
              Made by the <span style={{ color: theme.primary }}>community</span>.
            </h2>
            <div
              style={{
                marginTop: 10,
                fontSize: 20,
                color: theme.mutedForeground,
                maxWidth: 820,
              }}
            >
              Stations, spaceports, rail networks, factories — a sampler of
              what players have engineered together on the server.
            </div>
          </div>

          {/* Decorative pill — context that fits the "look what they built"
              story: everything in the mosaic was built by hand, in survival. */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 16px",
              borderRadius: 999,
              background: "rgba(30, 28, 35, 0.8)",
              border: `1px solid ${theme.border}`,
              color: theme.mutedForeground,
              fontSize: 14,
              fontFamily: theme.fontMono,
              whiteSpace: "nowrap",
              opacity: headerIn,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: theme.primary,
                boxShadow: `0 0 8px ${theme.primary}`,
              }}
            />
            Built in survival · block by block
          </div>
        </div>

        {/* Growing amber hairline under the header */}
        <div
          style={{
            width: `${lineGrow * 100}%`,
            maxWidth: 360,
            height: 1,
            background: `linear-gradient(90deg, ${theme.primary} 0%, transparent 100%)`,
            marginBottom: 28,
            opacity: 0.8,
          }}
        />

        {/* Asymmetric mosaic: one large hero tile + three stacked thumbs */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "grid",
            gridTemplateColumns: "1.55fr 1fr",
            gridTemplateRows: "1fr 1fr 1fr",
            gap: 18,
          }}
        >
          <div style={{ gridRow: "1 / span 3", minWidth: 0, minHeight: 0 }}>
            <BuildTile build={BUILDS[0]!} index={0} total={BUILDS.length} delay={14} large sceneDuration={SCENE} />
          </div>
          <div style={{ minWidth: 0, minHeight: 0 }}>
            <BuildTile build={BUILDS[1]!} index={1} total={BUILDS.length} delay={24} sceneDuration={SCENE} />
          </div>
          <div style={{ minWidth: 0, minHeight: 0 }}>
            <BuildTile build={BUILDS[2]!} index={2} total={BUILDS.length} delay={34} sceneDuration={SCENE} />
          </div>
          <div style={{ minWidth: 0, minHeight: 0 }}>
            <BuildTile build={BUILDS[3]!} index={3} total={BUILDS.length} delay={44} sceneDuration={SCENE} />
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
