import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { Background } from "../components/Background";
import { LOGOS } from "../components/assets";

export const CallToAction: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoIn = spring({ frame, fps, config: { damping: 18, stiffness: 100 } });
  const headline = spring({ frame: frame - 10, fps, config: { damping: 16, stiffness: 110 } });
  const sub = spring({ frame: frame - 24, fps, config: { damping: 20, stiffness: 90 } });
  const button = spring({ frame: frame - 42, fps, config: { damping: 14, stiffness: 120 } });
  const url = spring({ frame: frame - 60, fps, config: { damping: 20, stiffness: 90 } });

  const pulseScale = 1 + ((Math.sin(frame / 5) + 1) / 2) * 0.03;
  const glow = 0.4 + ((Math.sin(frame / 5) + 1) / 2) * 0.4;

  const finalFade = interpolate(frame, [140, 166], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity: finalFade }}>
      <Background
        image="assets/hero/space-ship-station.webp"
        zoom={[1.08, 1.2]}
        darken={0.72}
        gradient="both"
        durationInFrames={168}
      />

      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          padding: 100,
          textAlign: "center",
        }}
      >
        <Img
          src={staticFile(LOGOS.cogsAndSteam)}
          style={{
            width: 220,
            height: "auto",
            objectFit: "contain",
            opacity: logoIn,
            transform: `translateY(${(1 - logoIn) * -20}px)`,
            marginBottom: 40,
            filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.6))",
          }}
        />

        <div
          style={{
            fontSize: 22,
            letterSpacing: 10,
            color: theme.primary,
            fontWeight: 600,
            textTransform: "uppercase",
            marginBottom: 20,
            opacity: headline,
            transform: `translateY(${(1 - headline) * 20}px)`,
          }}
        >
          Ready to Build?
        </div>

        <div
          style={{
            fontSize: 120,
            fontWeight: 800,
            color: theme.foreground,
            letterSpacing: -3,
            lineHeight: 1.05,
            opacity: headline,
            transform: `translateY(${(1 - headline) * 40}px)`,
            maxWidth: 1600,
            textShadow: "0 6px 30px rgba(0,0,0,0.7)",
          }}
        >
          Join us and{" "}
          <span style={{ color: theme.primary, textShadow: `0 0 60px ${theme.primaryGlow}` }}>
            build something amazing
          </span>
          .
        </div>

        <div
          style={{
            marginTop: 30,
            fontSize: 26,
            color: "#d8d6de",
            maxWidth: 1000,
            opacity: sub,
            transform: `translateY(${(1 - sub) * 20}px)`,
            textShadow: "0 2px 8px rgba(0,0,0,0.8)",
          }}
        >
          Apply for whitelist access and start engineering the impossible.
        </div>

        <div
          style={{
            marginTop: 52,
            opacity: button,
            transform: `translateY(${(1 - button) * 30}px) scale(${button * pulseScale})`,
          }}
        >
          <div
            style={{
              padding: "24px 60px",
              borderRadius: 16,
              background: theme.primary,
              color: theme.backgroundDeep,
              fontSize: 34,
              fontWeight: 800,
              letterSpacing: 1,
              boxShadow: `0 0 80px rgba(245, 185, 33, ${glow}), 0 20px 40px rgba(0,0,0,0.4)`,
              display: "inline-flex",
              alignItems: "center",
              gap: 16,
            }}
          >
            Apply Now
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </div>
        </div>

        <div
          style={{
            marginTop: 36,
            fontSize: 26,
            fontFamily: theme.fontMono,
            color: theme.foreground,
            letterSpacing: 1,
            opacity: url,
            transform: `translateY(${(1 - url) * 16}px)`,
            textShadow: "0 2px 8px rgba(0,0,0,0.8)",
          }}
        >
          createrington.com
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
