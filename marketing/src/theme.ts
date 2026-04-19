// Pulled from packages/client/src/index.css — OkLCH values converted to
// approximate hex so Remotion's Chromium renderer handles them everywhere.
export const theme = {
  background: "#1b1a20",
  backgroundDeep: "#0f0e12",
  card: "#26242c",
  cardMuted: "#33313b",
  border: "rgba(255, 255, 255, 0.1)",
  foreground: "#f7f6fa",
  mutedForeground: "#a9a6b3",
  primary: "#f5b921",
  primarySoft: "rgba(245, 185, 33, 0.12)",
  primaryGlow: "rgba(245, 185, 33, 0.35)",
  success: "#4ade80",
  destructive: "#f87171",
  discord: "#5865f2",
  chart: {
    blue: "#5b8def",
    green: "#4ade80",
    amber: "#f5b921",
    purple: "#c084fc",
    red: "#f87171",
  },
  fontSans:
    '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif',
  fontMono:
    'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
} as const;

export const FPS = 30;

// Scene durations in frames (30fps)
export const DURATIONS = {
  logoIntro: 90,         // 3.0s
  heroTagline: 120,      // 4.0s
  statsShowcase: 150,    // 5.0s
  featuresGrid: 180,     // 6.0s
  featuredBuilds: 180,   // 6.0s — community builds mosaic
  structurePacks: 180,   // 6.0s — NEW: parallel-worlds voting
  playerRenders: 180,    // 6.0s — Puppeteer-rendered Discord cards
  webShowcase: 150,      // 5.0s — real screenshots showcase
  cryptoMarket: 210,     // 7.0s
  ecosystem: 180,        // 6.0s
  callToAction: 120,     // 4.0s
} as const;

export const TOTAL_DURATION = Object.values(DURATIONS).reduce((a, b) => a + b, 0);
