import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { DURATIONS, theme } from "./theme";
import { LogoIntro } from "./scenes/LogoIntro";
import { HeroTagline } from "./scenes/HeroTagline";
import { StatsShowcase } from "./scenes/StatsShowcase";
import { FeaturesGrid } from "./scenes/FeaturesGrid";
import { FeaturedBuilds } from "./scenes/FeaturedBuilds";
import { StructurePacks } from "./scenes/StructurePacks";
import { PlayerRenders } from "./scenes/PlayerRenders";
import { WebShowcase } from "./scenes/WebShowcase";
import { CryptoMarket } from "./scenes/CryptoMarket";
import { Ecosystem } from "./scenes/Ecosystem";
import { CallToAction } from "./scenes/CallToAction";

export const Video: React.FC = () => {
  let cursor = 0;
  const starts = {
    logo: cursor,
    hero: (cursor += DURATIONS.logoIntro),
    stats: (cursor += DURATIONS.heroTagline),
    features: (cursor += DURATIONS.statsShowcase),
    builds: (cursor += DURATIONS.featuresGrid),
    packs: (cursor += DURATIONS.featuredBuilds),
    renders: (cursor += DURATIONS.structurePacks),
    web: (cursor += DURATIONS.playerRenders),
    crypto: (cursor += DURATIONS.webShowcase),
    ecosystem: (cursor += DURATIONS.cryptoMarket),
    cta: (cursor += DURATIONS.ecosystem),
  };

  const OVERLAP = 14;

  return (
    <AbsoluteFill style={{ backgroundColor: theme.backgroundDeep, fontFamily: theme.fontSans }}>
      <Sequence from={starts.logo} durationInFrames={DURATIONS.logoIntro + OVERLAP}>
        <LogoIntro />
      </Sequence>

      <Sequence from={starts.hero} durationInFrames={DURATIONS.heroTagline + OVERLAP}>
        <HeroTagline />
      </Sequence>

      <Sequence from={starts.stats} durationInFrames={DURATIONS.statsShowcase + OVERLAP}>
        <StatsShowcase />
      </Sequence>

      <Sequence from={starts.features} durationInFrames={DURATIONS.featuresGrid + OVERLAP}>
        <FeaturesGrid />
      </Sequence>

      <Sequence from={starts.builds} durationInFrames={DURATIONS.featuredBuilds + OVERLAP}>
        <FeaturedBuilds />
      </Sequence>

      <Sequence from={starts.packs} durationInFrames={DURATIONS.structurePacks + OVERLAP}>
        <StructurePacks />
      </Sequence>

      <Sequence from={starts.renders} durationInFrames={DURATIONS.playerRenders + OVERLAP}>
        <PlayerRenders />
      </Sequence>

      <Sequence from={starts.web} durationInFrames={DURATIONS.webShowcase + OVERLAP}>
        <WebShowcase />
      </Sequence>

      <Sequence from={starts.crypto} durationInFrames={DURATIONS.cryptoMarket + OVERLAP}>
        <CryptoMarket />
      </Sequence>

      <Sequence from={starts.ecosystem} durationInFrames={DURATIONS.ecosystem + OVERLAP}>
        <Ecosystem />
      </Sequence>

      <Sequence from={starts.cta} durationInFrames={DURATIONS.callToAction}>
        <CallToAction />
      </Sequence>
    </AbsoluteFill>
  );
};
