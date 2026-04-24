export type TeamTier = "owner" | "dev-admin" | "admin";

export type HoverAnimation =
  | "walking"
  | "wave"
  | "running"
  | "flying"
  | "hit"
  | "jetpack"
  | "flashlight"
  | "moonwalk"
  | "headkick"
  | "hulk"
  | "nuke";

export type TeamMember = {
  username: string;
  uuid: string;
  role: string;
  tier: TeamTier;
  description?: string;
  hoverAnimation: HoverAnimation;
};

export const TEAM_MEMBERS: TeamMember[] = [
  {
    username: "saunhardy",
    uuid: "091b900c-4174-478c-900c-a0fe5a31a329",
    role: "Owner",
    tier: "owner",
    hoverAnimation: "flashlight",
  },
  {
    username: "Agent772",
    uuid: "3e0db446-147a-4692-87fd-c3facc4341db",
    role: "Developer",
    tier: "dev-admin",
    hoverAnimation: "jetpack",
  },
  {
    username: "The_BigShot",
    uuid: "4cada83a-c012-4a31-8d80-942f3f79e8a1",
    role: "Developer",
    tier: "dev-admin",
    hoverAnimation: "hulk",
  },
  {
    username: "diablothe2nd",
    uuid: "8cca5cab-b782-452b-a8b9-8bb4ae0f6d0f",
    role: "Admin",
    tier: "admin",
    hoverAnimation: "nuke",
  },
  {
    username: "Tetsuoken",
    uuid: "32ff995f-cf92-417b-b745-891738346120",
    role: "Admin",
    tier: "admin",
    hoverAnimation: "headkick",
  },
  {
    username: "Cailin05",
    uuid: "aee71815-6420-444c-a245-9047c41f4a39",
    role: "Admin",
    tier: "admin",
    hoverAnimation: "moonwalk",
  },
];

/** Podium order: Dev&Admin, Owner, Dev&Admin, Admin, Admin, Admin */
export const PODIUM_ORDER = [
  TEAM_MEMBERS[1], // Agent772 — Dev & Admin
  TEAM_MEMBERS[0], // saunhardy — Owner (center-left)
  TEAM_MEMBERS[2], // The_BigShot — Dev & Admin
  TEAM_MEMBERS[3], // diablothe2nd — Admin
  TEAM_MEMBERS[4], // Tetsuoken — Admin
  TEAM_MEMBERS[5], // Cailin05 — Admin
];

export const TIER_CONFIG = {
  owner: {
    size: {
      desktop: { width: 150, height: 230 },
      mobile: { width: 110, height: 165 },
    },
    badgeClass: "bg-[#ff0000]/20 text-[#ff0000] border-[#ff0000]/30",
  },
  "dev-admin": {
    size: {
      desktop: { width: 120, height: 185 },
      mobile: { width: 90, height: 135 },
    },
    badgeClass: "bg-[#50c878]/20 text-[#50c878] border-[#50c878]/30",
  },
  admin: {
    size: {
      desktop: { width: 110, height: 170 },
      mobile: { width: 80, height: 120 },
    },
    badgeClass: "bg-[#e36009]/20 text-[#e36009] border-[#e36009]/30",
  },
} as const;
