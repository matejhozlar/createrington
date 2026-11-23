import {
  Cog,
  Coins,
  Map,
  Palette,
  Store,
  Wallet,
  Wrench,
  Zap,
} from "lucide-react";

export const HERO_IMAGES = [
  "/assets/hero/gondola-station.webp",
  "/assets/hero/dark-warehouse.webp",
  "/assets/hero/high-speed-train.webp",
  "/assets/hero/mountains-train-station.webp",
  "/assets/hero/space-ship-station.webp",
];

export const FEATURES = [
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

export const MOD_CATEGORIES = [
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
        description: "Live timetables and route planning for the rail network",
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
        description: "Girders, panels, and palettes that match Create's style",
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

export const ECONOMY_FEATURES = [
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
