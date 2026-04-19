import React from "react";
import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { Background } from "../components/Background";

const CREDIT_SECTIONS = [
  {
    label: "Video",
    members: [
      { uuid: "091b900c-4174-478c-900c-a0fe5a31a329", name: "saunhardy" },
      { uuid: "4cada83a-c012-4a31-8d80-942f3f79e8a1", name: "The_BigShot" },
    ],
  },
  {
    label: "Music",
    members: [
      { uuid: "8cca5cab-b782-452b-a8b9-8bb4ae0f6d0f", name: "diablothe2nd" },
    ],
  },
  {
    label: "The Team",
    members: [
      { uuid: "32ff995f-cf92-417b-b745-891738346120", name: "Tetsuoken" },
      { uuid: "25f73ab5-39e3-4bf7-bd52-9ad7407fdb3e", name: "Stratos65" },
      { uuid: "69bc13fe-1972-480e-8075-c88340d7b7da", name: "imahomen" },
      { uuid: "aee71815-6420-444c-a245-9047c41f4a39", name: "Cailin05" },
    ],
  },
];

export const Credits: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [140, 172], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const headerIn = spring({ frame, fps, config: { damping: 18, stiffness: 100 } });

  return (
    <AbsoluteFill style={{ opacity: fadeIn * fadeOut }}>
      <Background
        image="assets/hero/dark-warehouse.webp"
        zoom={[1.02, 1.05]}
        blur={30}
        darken={0.9}
        gradient="none"
        durationInFrames={200}
      />

      <AbsoluteFill
        style={{
          padding: "80px 120px",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div
          style={{
            opacity: headerIn,
            transform: `translateY(${(1 - headerIn) * 16}px)`,
            textAlign: "center",
            marginBottom: 56,
          }}
        >
          <div
            style={{
              fontSize: 22,
              letterSpacing: 8,
              color: theme.primary,
              fontWeight: 600,
              textTransform: "uppercase",
              marginBottom: 14,
            }}
          >
            Credits
          </div>
          <h2
            style={{
              fontSize: 64,
              fontWeight: 700,
              color: theme.foreground,
              letterSpacing: -1.5,
              margin: 0,
              lineHeight: 1.05,
            }}
          >
            Thanks to the <span style={{ color: theme.primary }}>community</span>.
          </h2>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 44,
            alignItems: "center",
          }}
        >
          {CREDIT_SECTIONS.map((section, i) => {
            const delay = 18 + i * 12;
            const sectionIn = spring({
              frame: frame - delay,
              fps,
              config: { damping: 18, stiffness: 100 },
            });
            return (
              <div
                key={section.label}
                style={{
                  opacity: sectionIn,
                  transform: `translateY(${(1 - sectionIn) * 20}px)`,
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontSize: 16,
                    letterSpacing: 6,
                    color: theme.mutedForeground,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    marginBottom: 20,
                    fontFamily: theme.fontMono,
                  }}
                >
                  {section.label}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 44,
                    justifyContent: "center",
                    flexWrap: "wrap",
                  }}
                >
                  {section.members.map((m) => (
                    <div
                      key={m.uuid}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 14,
                        fontFamily: theme.fontMono,
                        fontSize: 24,
                        color: theme.foreground,
                        letterSpacing: 0.3,
                        textShadow: "0 1px 6px rgba(0,0,0,0.8)",
                      }}
                    >
                      <Img
                        src={`https://mc-heads.net/avatar/${m.uuid}/96`}
                        style={{
                          width: 54,
                          height: 54,
                          imageRendering: "pixelated",
                          filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.7))",
                        }}
                      />
                      <span>{m.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
