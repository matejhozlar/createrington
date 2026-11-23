import { SkinApiPromo } from "@/components/skin-api-promo";
import { CommunitySection } from "./components/CommunitySection";
import { EconomySection } from "./components/EconomySection";
import { FeaturesSection } from "./components/FeaturesSection";
import { HeroSection } from "./components/HeroSection";
import { JoinSection } from "./components/JoinSection";
import { ModsSection } from "./components/ModsSection";

export function Home() {
  return (
    <div>
      <HeroSection />
      <FeaturesSection />
      <CommunitySection />
      <ModsSection />
      <EconomySection />
      <SkinApiPromo />
      <JoinSection />
    </div>
  );
}
