// Central registry of the real app assets copied into marketing/public.
// Using paths (strings) not staticFile() — callers pass these into Remotion's
// staticFile() themselves so HMR in the studio picks up changes.

export const HERO_IMAGES = [
  "assets/hero/gondola-station.webp",
  "assets/hero/dark-warehouse.webp",
  "assets/hero/high-speed-train.webp",
  "assets/hero/mountains-train-station.webp",
  "assets/hero/space-ship-station.webp",
] as const;

export const LOGOS = {
  cogsAndSteam: "assets/logo/cogs-and-steam-logo.webp",
  createrington: "assets/logo/createrington-logo.webp",
  discord: "assets/logo/discord.webp",
  curseforge: "assets/logo/curseforge.webp",
  bot: "assets/logo/createrington-bot.webp",
} as const;

export const FEATURE_CARDS = [
  {
    title: "Create at the Core",
    description:
      "Gears, belts, steam, and logic-powered machines with Create and carefully chosen expansions.",
    background: "assets/features/create-workshop.webp",
    icon: "assets/features/cogwheel.webp",
  },
  {
    title: "Economy & Trading",
    description:
      "Physical currency, automated shops, and in-game ATMs synced across Minecraft, Discord, and web.",
    background: "assets/features/market-stall.webp",
    icon: "assets/features/currency.webp",
  },
  {
    title: "Built for Multiplayer",
    description:
      "Shared infrastructure, player shops, and tools that encourage collaboration over isolation.",
    background: "assets/features/map-overview.webp",
    icon: "assets/features/player-heads.webp",
  },
  {
    title: "Curated, Not Bloated",
    description:
      "100+ mods chosen for balance and performance. No kitchen-sink chaos — every mod earns its place.",
    background: "assets/features/modpack.webp",
    icon: "assets/features/chipped-workbench.webp",
  },
] as const;

export const SCREENSHOTS = {
  homepage: "screenshots/homepage.webp",
  cryptoMarket: "screenshots/crypto-market.webp",
  cryptoChart: "screenshots/crypto-chart.webp",
  cryptoPortfolio: "screenshots/crypto-portfolio.webp",
  adminDashboard: "screenshots/admin-dashboard.webp",
  adminCrypto: "screenshots/admin-crypto.webp",
  adminPlayers: "screenshots/admin-players.webp",
  onlinePlayers: "screenshots/online-players.webp",
  webChat: "screenshots/web-chat.webp",
  renderProfile: "screenshots/render-profile.webp",
  renderTop: "screenshots/render-top.webp",
  renderActivity: "screenshots/render-activty.webp",
  renderCompare: "screenshots/render-compare.webp",
} as const;
