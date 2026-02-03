import React from "react";
import styles from "./Home.module.scss";
import { useAuth } from "@/contexts/auth";
import { Button } from "@/components/ui/button";
import { NavLink } from "react-router-dom";
import { ArrowRight, Download } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import Fade from "embla-carousel-fade";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const heroImages = [
  "/assets/hero/gondola-station.webp",
  "/assets/hero/dark-warehouse.webp",
  "/assets/hero/high-speed-train.webp",
  "/assets/hero/mountains-train-station.webp",
  "/assets/hero/space-ship-station.webp",
];

const features = [
  {
    title: "Create at the Core",
    description:
      "Gears, belts, steam, and logic-powered machines with Create and carefully chosen expansions.",
    backgroundImage: "/assets/features/create-workshop.webp",
    icon: "/assets/features/cogwheel.webp",
  },
  {
    title: "Economy & Trading",
    description:
      "Build your fortune through player markets, automated shops, and strategic resource management.",
    backgroundImage: "/assets/features/market-stall.webp",
    icon: "/assets/features/currency.webp",
  },
  {
    title: "Built for Multiplayer",
    description:
      "Player shops, shared infrastructure, and tools that encourage collaboration.",
    backgroundImage: "/assets/features/map-overview.webp",
    icon: "/assets/features/player-heads.webp",
  },
  {
    title: "Curated, Not Bloated",
    description:
      "No kitchen-sink chaos. Our 100+ mods were chosen for balance and performance.",
    backgroundImage: "/assets/features/modpack.webp",
    icon: "/assets/features/chipped-workbench.webp",
  },
];

export const Home: React.FC = () => {
  const { user, login } = useAuth();

  const autoplayPlugin = React.useRef(
    Autoplay({ delay: 5000, stopOnInteraction: false }),
  );

  return (
    <div>
      {/* New Hero Section */}
      <section className="relative w-full overflow-hidden">
        <Carousel
          opts={{ loop: true }}
          plugins={[Fade(), autoplayPlugin.current]}
          className="absolute inset-0 h-full"
        >
          <CarouselContent className="h-full ml-0">
            {heroImages.map((image, index) => (
              <CarouselItem key={index} className="h-full pl-0 basis-full">
                <div
                  className="w-full h-full bg-cover bg-center bg-no-repeat"
                  style={{
                    backgroundImage: `url('${image}')`,
                  }}
                />
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>

        <div className="absolute top-1/3 inset-0 bg-linear-to-t from-background via-background/80 to-transparent pointer-events-none" />

        <div className="py-12 px-8">
          <div className="relative h-full flex flex-col max-w-7xl mx-auto">
            {/* Server Logo */}
            <div className="">
              <img
                src="/assets/logo/cogs-and-steam-logo.webp"
                alt="Cogs and Steam Logo"
                className="h-16 w-auto md:h-20 lg:h-24 object-contain"
              />
            </div>

            <div className="flex-1 flex items-end min-h-136">
              <div className="space-y-6 pt-12">
                {/* Tagline */}
                <h1 className="max-w-4xl text-5xl md:text-5xl lg:text-6xl font-bold text-white drop-shadow-lg">
                  Build Big. Automate Everything.
                </h1>

                <p className="text-lg md:text-xl lg:text-2xl text-gray-200 max-w-2xl leading-relaxed drop-shadow-md">
                  Cogs & Steam is a Create-powered server built for players who
                  love clever machines, beautiful builds, and total creative
                  freedom. From small farms to automated factories, every idea
                  has a place here.
                </p>

                {/* CTA */}
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {!user ? (
                    <Button size="lg" className="text-lg" asChild>
                      <NavLink to="/apply-to-join">
                        Apply Now
                        <ArrowRight />
                      </NavLink>
                    </Button>
                  ) : (
                    <Button size="lg" className="text-lg" asChild>
                      <a
                        href="https://www.curseforge.com/minecraft/modpacks/create-rington"
                        target="_blank"
                      >
                        <Download />
                        Download Modpack
                      </a>
                    </Button>
                  )}

                  <Button size="lg" variant="outline" asChild>
                    <a href="#server-features">Learn More</a>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative -mt-px py-12 px-8 bg-background">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-semibold text-center mb-12 text-foreground" id="server-features">
            Cogs & Steam Server Features
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="overflow-hidden border-border pt-0">
                <div className="p-2">
                  <div className="relative aspect-video">
                    {/* Background Image */}
                    <div
                      className="absolute inset-0 bg-cover bg-center rounded-lg"
                      style={{
                        backgroundImage: `url('${feature.backgroundImage}')`,
                      }}
                    />

                    {/* Dark Overlay */}
                    <div className="absolute inset-0 bg-black/70 rounded-lg" />

                    {/* Feature Icon */}
                    <div className="absolute top-2 left-2">
                      <img
                        src={feature.icon}
                        alt={feature.title}
                        className="max-w-24 max-h-24 shadow-md"
                      />
                    </div>
                  </div>
                </div>

                <CardHeader>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>

                  <CardDescription className="text-base">
                    {feature.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Original Hero Section - keeping for reference */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>
            Welcome to <span className={styles.highlight}>MyServer</span>
          </h1>
          <p className={styles.heroSubtitle}>
            Join our amazing Minecraft community and experience the best
            gameplay
          </p>
          {!user && (
            <button className={styles.ctaButton} onClick={login}>
              Get Started with Discord
            </button>
          )}
          {user && (
            <div className={styles.welcomeBack}>
              <p className={styles.welcomeText}>
                Welcome back,{" "}
                <span className={styles.highlight}>
                  {user.minecraftUsername}
                </span>
                !
              </p>
              <a href="/servers" className={styles.ctaButton}>
                View Servers
              </a>
            </div>
          )}
        </div>
        <div className={styles.heroDecoration}>
          <div className={styles.glowOrb} />
          <div className={styles.glowOrb} />
        </div>
      </section>

      {/* Features Section */}
      <section className={styles.features}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>Why Choose Us?</h2>
          <div className={styles.featureGrid}>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 2L2 7l10 5 10-5-10-5z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M2 17l10 5 10-5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M2 12l10 5 10-5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h3 className={styles.featureTitle}>Multiple Servers</h3>
              <p className={styles.featureDescription}>
                Choose from our diverse range of game modes and experiences
              </p>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle
                    cx="9"
                    cy="7"
                    r="4"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M23 21v-2a4 4 0 0 0-3-3.87"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M16 3.13a4 4 0 0 1 0 7.75"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h3 className={styles.featureTitle}>Active Community</h3>
              <p className={styles.featureDescription}>
                Join thousands of players in our vibrant Discord community
              </p>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <polyline
                    points="12 6 12 12 16 14"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h3 className={styles.featureTitle}>24/7 Uptime</h3>
              <p className={styles.featureDescription}>
                Reliable servers with minimal downtime and regular updates
              </p>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h3 className={styles.featureTitle}>Secure & Fair</h3>
              <p className={styles.featureDescription}>
                Advanced anti-cheat and moderation to ensure fair gameplay
              </p>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <polyline
                    points="22 12 18 12 15 21 9 3 6 12 2 12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h3 className={styles.featureTitle}>Performance</h3>
              <p className={styles.featureDescription}>
                Optimized servers for smooth gameplay with minimal lag
              </p>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h3 className={styles.featureTitle}>Support</h3>
              <p className={styles.featureDescription}>
                Dedicated staff team ready to help with any issues
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className={styles.stats}>
        <div className={styles.container}>
          <div className={styles.statsGrid}>
            <div className={styles.statItem}>
              <div className={styles.statValue}>1,000+</div>
              <div className={styles.statLabel}>Active Players</div>
            </div>
            <div className={styles.statItem}>
              <div className={styles.statValue}>99.9%</div>
              <div className={styles.statLabel}>Uptime</div>
            </div>
            <div className={styles.statItem}>
              <div className={styles.statValue}>5+</div>
              <div className={styles.statLabel}>Game Modes</div>
            </div>
            <div className={styles.statItem}>
              <div className={styles.statValue}>24/7</div>
              <div className={styles.statLabel}>Support</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      {!user && (
        <section className={styles.cta}>
          <div className={styles.ctaContent}>
            <h2 className={styles.ctaTitle}>Ready to Join?</h2>
            <p className={styles.ctaSubtitle}>
              Sign in with Discord and start your adventure today
            </p>
            <button className={styles.ctaButtonLarge} onClick={login}>
              Login with Discord
            </button>
          </div>
        </section>
      )}
    </div>
  );
};
