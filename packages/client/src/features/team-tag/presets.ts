export type PlatePreset = {
  name: string;
  plate: number;
  letters: number;
};

export const PLATE_PRESETS: PlatePreset[] = [
  { name: "Brass", plate: 0xd9a441, letters: 0x3b230e },
  { name: "Copper", plate: 0xc96a3d, letters: 0xfff0dc },
  { name: "Andesite", plate: 0x9a9c97, letters: 0x222421 },
  { name: "Zinc", plate: 0xbcc8cb, letters: 0x24323a },
  { name: "Railway", plate: 0x2d5b8a, letters: 0xffe49a },
  { name: "Signal", plate: 0xb5302a, letters: 0xffffff },
  { name: "Mint", plate: 0x3fa37a, letters: 0x0e2a1d },
  { name: "Obsidian", plate: 0x2a2340, letters: 0xc9a6ff },
];

export type Rank = {
  label: string;
  color: number;
  icon: string;
};

const RANK_ICONS = "/assets/team-tag/ranks";

export const RANKS: Rank[] = [
  { label: "Shaft Scraper", color: 0x7b5733, icon: `${RANK_ICONS}/wood.png` },
  { label: "Cog Carrier", color: 0xb0b0b0, icon: `${RANK_ICONS}/stone.png` },
  {
    label: "Kinetic Operator",
    color: 0xb87333,
    icon: `${RANK_ICONS}/copper.png`,
  },
  {
    label: "Mechanical Assembler",
    color: 0xd8d8d8,
    icon: `${RANK_ICONS}/iron.png`,
  },
  {
    label: "Brass Technician",
    color: 0xffd700,
    icon: `${RANK_ICONS}/gold.png`,
  },
  {
    label: "Steam Engineer",
    color: 0x00ffff,
    icon: `${RANK_ICONS}/diamond.png`,
  },
  {
    label: "Factory Overseer",
    color: 0x38e08f,
    icon: `${RANK_ICONS}/emerald.png`,
  },
  {
    label: "Master Automaton",
    color: 0x3c3c3c,
    icon: `${RANK_ICONS}/netherite.png`,
  },
  {
    label: "Clockwork Architect",
    color: 0xb57cff,
    icon: `${RANK_ICONS}/nether-star.png`,
  },
];

export const GUI_SCALES = ["2", "3", "4"] as const;
export type GuiScale = (typeof GUI_SCALES)[number];

export const BACKDROPS = [
  { value: "night", label: "Night", src: "/assets/hero/dark-warehouse.webp" },
  { value: "metro", label: "Metro", src: "/assets/hero/metro.webp" },
  {
    value: "sunset",
    label: "Sunset",
    src: "/assets/hero/high-speed-train.webp",
  },
  { value: "sky", label: "Sky", src: "/assets/hero/space-station.webp" },
] as const;
export type Backdrop = (typeof BACKDROPS)[number]["value"];
