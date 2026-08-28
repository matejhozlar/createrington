import { useState } from "react";
import { useAuth } from "@/contexts/auth";
import { Button } from "@/components/ui/button";
import { NavLink } from "react-router";
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
import { Badge } from "@/components/ui/badge";
import {
  Users,
  TrendingUp,
  Clock,
  ExternalLink,
  Cog,
  Palette,
  Map,
  Wrench,
  Wallet,
  Coins,
  Store,
  Zap,
} from "lucide-react";
import { useServerData } from "@/contexts/server-data";
import { CURSEFORGE_MODPACK_URL } from "@/lib/external-urls";
import { trpc } from "@/lib/trpc";
import { Loading } from "@/components/loading-spinner";

export function Home() {
  const { user } = useAuth();

  const [autoplayPlugin] = useState(() =>
    Autoplay({ delay: 5000, stopOnInteraction: false }),
  );

  // TODO: When converting to multiple servers, update this to use the selected server
  const serverId = 1;
  const { servers } = useServerData();
  const server = servers.find((s) => s.serverId === serverId);

  const { data: playerCount, isLoading: isLoadingPlayers } =
    trpc.public.players.count.useQuery({});

  const { data: playtimeData, isLoading: isLoadingPlaytime } =
    trpc.public.metrics.playtime.getTotalHours.useQuery({ serverId });

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
        "No kitchen-sink chaos. Our 200+ mods were chosen for balance and performance.",
      backgroundImage: "/assets/features/modpack.webp",
      icon: "/assets/features/chipped-workbench.webp",
    },
  ];

  const serverMetrics = [
    {
      icon: Users,
      value: server?.playerCount ?? 0,
      title: "Players Online",
      description: "Active players right now",
    },
    {
      icon: TrendingUp,
      value: isLoadingPlayers ? "..." : (playerCount?.count ?? "N/A"),
      title: "Total Players",
      description: "Registered community members",
    },
    {
      icon: Clock,
      value: isLoadingPlaytime ? (
        <Loading />
      ) : (
        (playtimeData?.totalHours ?? "N/A")
      ),
      title: "Hours Played",
      description: "Total playtime across all players",
    },
  ];

  const modCategories = [
    {
      title: "Tech & Automation",
      icon: Cog,
      mods: [
        {
          name: "Create",
          description:
            "The foundation of our server with rotational power and automation",
          url: "https://www.curseforge.com/minecraft/mc-mods/create",
        },
        {
          name: "Create: Steam 'n' Rails",
          description: "Advanced trains, tracks, and railway systems",
          url: "https://www.curseforge.com/minecraft/mc-mods/steam-n-rails-neoforge",
        },
        {
          name: "Create Aeronautics",
          description: "Build airships and take your contraptions into the sky",
          url: "https://www.curseforge.com/minecraft/mc-mods/create-aeronautics",
        },
        {
          name: "Create Railways Navigator",
          description:
            "Live timetables and route planning for the rail network",
          url: "https://www.curseforge.com/minecraft/mc-mods/create-railways-navigator",
        },
      ],
    },
    {
      title: "Building & Decoration",
      icon: Palette,
      mods: [
        {
          name: "Chipped",
          description: "Thousands of block variants for creative building",
          url: "https://www.curseforge.com/minecraft/mc-mods/chipped",
        },
        {
          name: "Rechiseled",
          description: "Endless decorative styles and textures for blocks",
          url: "https://www.curseforge.com/minecraft/mc-mods/rechiseled",
        },
        {
          name: "Create: Copycats+",
          description: "Tons of custom block shapes and mimic textures",
          url: "https://www.curseforge.com/minecraft/mc-mods/copycats",
        },
        {
          name: "Create Deco",
          description:
            "Girders, panels, and palettes that match Create's style",
          url: "https://www.curseforge.com/minecraft/mc-mods/create-deco",
        },
      ],
    },
    {
      title: "Exploration",
      icon: Map,
      mods: [
        {
          name: "Xaero's Minimap",
          description: "A minimap mod that provides a detailed map",
          url: "https://www.curseforge.com/minecraft/mc-mods/xaeros-minimap",
        },
        {
          name: "Farmer's Delight",
          description: "Expanded farming and cooking mechanics",
          url: "https://www.curseforge.com/minecraft/mc-mods/farmers-delight",
        },
        {
          name: "Naturalist",
          description: "Lifelike wildlife scattered across every biome",
          url: "https://www.curseforge.com/minecraft/mc-mods/naturalist",
        },
        {
          name: "Upgrade Aquatic",
          description: "Richer oceans and rivers to explore",
          url: "https://www.curseforge.com/minecraft/mc-mods/upgrade-aquatic",
        },
      ],
    },
    {
      title: "Utility & QoL",
      icon: Wrench,
      mods: [
        {
          name: "Sophisticated Storage",
          description: "Advanced barrels, chests, and shulker boxes",
          url: "https://www.curseforge.com/minecraft/mc-mods/sophisticated-storage",
        },
        {
          name: "Simple Voice Chat",
          description: "Voice chat for multiplayer without external software",
          url: "https://www.curseforge.com/minecraft/mc-mods/simple-voice-chat",
        },
        {
          name: "Jade",
          description: "See block and entity information at a glance",
          url: "https://www.curseforge.com/minecraft/mc-mods/jade",
        },
        {
          name: "JEI (Just Enough Items)",
          description: "Recipe viewer and item list for all mods",
          url: "https://www.curseforge.com/minecraft/mc-mods/jei",
        },
      ],
    },
  ];

  const economyFeatures = [
    {
      icon: Wallet,
      title: "Physical Currency Items",
      description:
        "Collect and trade stackable bills with custom textures. Carry your wealth in your inventory.",
    },
    {
      icon: Zap,
      title: "Real-Time Synchronization",
      description:
        "Your balance updates instantly across Minecraft, Discord, web dashboard, and API.",
    },
    {
      icon: Store,
      title: "Automated Shop Integration",
      description:
        "Tap bank cards at Create-powered registers for seamless automated transactions.",
    },
    {
      icon: Coins,
      title: "ATM Banking System",
      description:
        "Deposit and withdraw currency at in-game ATMs. Virtual and physical money in perfect harmony.",
    },
  ];

  return (
    <div>
      {/* New Hero Section */}
      <section className="relative w-full overflow-hidden">
        <Carousel
          opts={{ loop: true }}
          plugins={[Fade(), autoplayPlugin]}
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

        <div className="py-12 px-5 md:px-8">
          <div className="relative h-full flex flex-col max-w-7xl mx-auto">
            {/* Server Logo and Status */}
            <div className="flex items-center justify-between gap-2 ">
              <img
                src="/assets/logo/rails-n-sails-logo.webp"
                alt="Rails 'n Sails Logo"
                className="h-16 w-auto md:h-20 lg:h-24 object-contain"
              />

              <Badge
                className={`bg-zinc-900/70 text-lg px-2 sm:px-4 py-2 gap-2 shadow-md ${server?.online ? "text-green-500" : "text-destructive"}`}
                variant={"outline"}
              >
                <span
                  className={`size-4 rounded-full ${server?.online ? "bg-green-500 animate-pulse" : "bg-destructive"}`}
                />
                <span className="hidden sm:inline">
                  {server?.online ? "Online" : "Offline"}
                </span>
              </Badge>
            </div>

            <div className="flex-1 flex items-end min-h-148">
              <div className="space-y-6 pt-12">
                {/* Tagline */}
                <h1 className="max-w-4xl text-5xl md:text-5xl lg:text-6xl font-bold text-white drop-shadow-lg">
                  Build <span className="text-primary">Big</span>. Automate{" "}
                  <span className="text-primary">Everything</span>.
                </h1>

                <p className="text-lg md:text-xl lg:text-2xl text-gray-200 max-w-2xl leading-relaxed drop-shadow-md">
                  Rails 'n Sails is a Create-powered server built for players
                  who love clever machines, beautiful builds, and total creative
                  freedom. From small farms to sprawling rail networks and
                  airships, every idea has a place here.
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
                        href={CURSEFORGE_MODPACK_URL}
                        target="_blank"
                        rel="noopener noreferrer"
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
      <section className="relative -mt-px py-12 px-5 md:px-8 bg-background">
        <div className="max-w-7xl mx-auto">
          <div
            className="flex flex-col gap-3 items-center mb-12"
            id="server-features"
          >
            <h2 className="text-4xl md:text-5xl font-semibold text-foreground">
              Why Join Rails 'n Sails?
            </h2>

            <p className="text-lg md:text-xl text-primary max-w-2xl">
              A carefully crafted server designed for engineers and builders
              alike
            </p>
          </div>

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

      {/* Server Metrics Section */}
      <section id="learn-more" className="py-16 px-5 md:px-8 bg-zinc-950">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col gap-3 items-center mb-12">
            <h2 className="text-4xl md:text-5xl font-semibold text-foreground">
              Join a Thriving Community
            </h2>

            <p className="text-lg md:text-xl text-primary max-w-2xl">
              Our server is home to a vibrant community of builders and creators
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {serverMetrics.map((metric, index) => {
              const IconComponent = metric.icon;
              return (
                <Card key={index} className="bg-background">
                  <CardHeader className="text-center space-y-4">
                    <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <IconComponent className="w-8 h-8 text-primary" />
                    </div>

                    <div>
                      <div className="text-5xl font-bold text-foreground mb-2">
                        {metric.value}
                      </div>

                      <CardTitle className="text-xl text-foreground">
                        {metric.title}
                      </CardTitle>

                      <CardDescription className="text-base mt-2">
                        {metric.description}
                      </CardDescription>
                    </div>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Modpack Section */}
      <section className="py-16 px-5 md:px-8 bg-background">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
            <div className="flex flex-col gap-3">
              <h2 className="text-4xl md:text-5xl font-semibold text-foreground">
                The Ultimate Create Experience
              </h2>

              <p className="text-lg md:text-xl text-primary max-w-2xl">
                Just a few of the curated selection of mods that power our
                server.
              </p>
            </div>

            <Button size="lg" variant="secondary" asChild className="shrink-0">
              <a
                href={`${CURSEFORGE_MODPACK_URL}/relations/dependencies`}
                target="_blank"
                rel="noopener noreferrer"
              >
                View Full Modlist
                <ExternalLink className="ml-2" />
              </a>
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {modCategories.map((category, categoryIndex) => {
              const IconComponent = category.icon;
              return (
                <div key={categoryIndex} className="flex flex-col gap-4">
                  {/* Category Header */}
                  <div className="flex items-center gap-2">
                    <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <IconComponent className="size-5 text-primary" />
                    </div>

                    <h3 className="text-xl font-semibold text-foreground">
                      {category.title}
                    </h3>
                  </div>

                  {/* Mods List */}
                  <div className="flex flex-col gap-3">
                    {category.mods.map((mod, modIndex) => (
                      <a
                        key={modIndex}
                        href={mod.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex flex-col gap-1 rounded-lg p-3 transition-colors hover:bg-muted"
                      >
                        <div className="flex items-center gap-1">
                          <p className="font-medium text-foreground">
                            {mod.name}
                          </p>

                          <ExternalLink className="size-3 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                        </div>

                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {mod.description}
                        </p>
                      </a>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Economy Features Section */}
      <section className="py-16 px-5 md:px-8 bg-zinc-950">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
            {/* Left Side - Content */}
            <div className="flex-1 flex flex-col gap-8">
              <div className="flex flex-col gap-3">
                <h2 className="text-4xl md:text-5xl font-semibold text-foreground">
                  A Revolutionary Economy System
                </h2>

                <p className="text-lg md:text-xl text-primary">
                  Earn, spend, and manage your wealth with our custom-built
                  economy plugin
                </p>
              </div>

              {/* Features Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-8">
                {economyFeatures.map((feature, index) => {
                  const IconComponent = feature.icon;
                  return (
                    <div key={index} className="flex flex-col gap-5">
                      <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <IconComponent className="text-primary size-5" />
                      </div>

                      <div className="flex flex-col gap-2">
                        <h3 className="text-foreground font-semibold">
                          {feature.title}
                        </h3>

                        <p className="text-muted-foreground">
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Side - Image */}
            <div className="w-full flex-1">
              <div className="relative w-full aspect-square">
                <img
                  src="/assets/features/gondola-station-atms.webp"
                  alt="Economy system featuring ATMs and banking"
                  className="rounded-xl object-cover w-full h-full"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="bg-muted py-16 px-5 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex w-full flex-col items-center justify-between gap-8 text-center md:flex-row md:text-left">
            <h2 className="text-foreground text-4xl md:text-5xl font-semibold max-w-lg text-pretty">
              Join Us and Build Something Amazing
            </h2>

            <div className="flex flex-col gap-3 md:flex-row">
              <Button size="lg" asChild>
                <NavLink to="/apply-to-join" className="text-xl! px-8! py-6!">
                  Apply Now
                  <ArrowRight />
                </NavLink>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
