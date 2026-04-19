import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { Background } from "../components/Background";
import { FEATURE_CARDS } from "../components/assets";

export const FeaturesGrid: React.FC = () => {
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
        image="assets/hero/gondola-station.webp"
        zoom={[1.05, 1.12]}
        blur={18}
        darken={0.82}
        gradient="none"
        durationInFrames={194}
      />

      <AbsoluteFill
        style={{
          padding: "90px 120px",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            marginBottom: 56,
            opacity: headerIn,
            transform: `translateY(${(1 - headerIn) * 24}px)`,
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
            Why Join Us?
          </div>
          <h2
            style={{
              fontSize: 76,
              fontWeight: 700,
              color: theme.foreground,
              letterSpacing: -2,
              margin: 0,
            }}
          >
            Engineered for <span style={{ color: theme.primary }}>builders</span>.
          </h2>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 24,
          }}
        >
          {FEATURE_CARDS.map((f, i) => {
            const delay = 20 + i * 10;
            const t = spring({
              frame: frame - delay,
              fps,
              config: { damping: 16, stiffness: 110 },
            });
            return (
              <div
                key={i}
                style={{
                  background: theme.card,
                  border: `1px solid ${theme.border}`,
                  borderRadius: 20,
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  opacity: t,
                  transform: `translateY(${(1 - t) * 40}px) scale(${0.96 + t * 0.04})`,
                  boxShadow: `0 25px 60px rgba(0,0,0,0.55)`,
                }}
              >
                <div style={{ padding: 8 }}>
                  <div
                    style={{
                      position: "relative",
                      aspectRatio: "16 / 10",
                      borderRadius: 12,
                      overflow: "hidden",
                    }}
                  >
                    <Img
                      src={staticFile(f.background)}
                      style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background: "rgba(0,0,0,0.65)",
                      }}
                    />
                    <Img
                      src={staticFile(f.icon)}
                      style={{
                        position: "absolute",
                        top: 12,
                        left: 12,
                        width: 96,
                        height: 96,
                        objectFit: "contain",
                        filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.6))",
                      }}
                    />
                  </div>
                </div>

                <div style={{ padding: "20px 24px 28px" }}>
                  <div
                    style={{
                      fontSize: 24,
                      fontWeight: 700,
                      color: theme.foreground,
                      marginBottom: 10,
                      letterSpacing: -0.3,
                    }}
                  >
                    {f.title}
                  </div>
                  <div
                    style={{
                      fontSize: 16,
                      lineHeight: 1.5,
                      color: theme.mutedForeground,
                    }}
                  >
                    {f.description}
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
