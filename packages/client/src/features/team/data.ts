import agent772Skin from "@/assets/skins/team/agent772.png";
import cailin05Skin from "@/assets/skins/team/cailin05.png";
import diablothe2ndSkin from "@/assets/skins/team/diablothe2nd.png";
import saidaiVSkin from "@/assets/skins/team/saidai-v.png";
import saunhardySkin from "@/assets/skins/team/saunhardy.png";
import tetsuokenSkin from "@/assets/skins/team/tetsuoken.png";
import theBigShotSkin from "@/assets/skins/team/the-bigshot.png";

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
  | "nuke"
  | "explode";

export type TeamMember = {
  username: string;
  uuid: string;
  skin: string;
  role: string;
  tier: TeamTier;
  hoverAnimation: HoverAnimation;
};

const saunhardy: TeamMember = {
  username: "saunhardy",
  uuid: "091b900c-4174-478c-900c-a0fe5a31a329",
  skin: saunhardySkin,
  role: "Owner",
  tier: "owner",
  hoverAnimation: "flashlight",
};

const agent772: TeamMember = {
  username: "Agent772",
  uuid: "3e0db446-147a-4692-87fd-c3facc4341db",
  skin: agent772Skin,
  role: "Developer",
  tier: "dev-admin",
  hoverAnimation: "jetpack",
};

const theBigShot: TeamMember = {
  username: "The_BigShot",
  uuid: "4cada83a-c012-4a31-8d80-942f3f79e8a1",
  skin: theBigShotSkin,
  role: "Developer",
  tier: "dev-admin",
  hoverAnimation: "hulk",
};

const diablothe2nd: TeamMember = {
  username: "diablothe2nd",
  uuid: "8cca5cab-b782-452b-a8b9-8bb4ae0f6d0f",
  skin: diablothe2ndSkin,
  role: "Admin",
  tier: "admin",
  hoverAnimation: "nuke",
};

const tetsuoken: TeamMember = {
  username: "Tetsuoken",
  uuid: "32ff995f-cf92-417b-b745-891738346120",
  skin: tetsuokenSkin,
  role: "Admin",
  tier: "admin",
  hoverAnimation: "headkick",
};

const cailin05: TeamMember = {
  username: "Cailin05",
  uuid: "aee71815-6420-444c-a245-9047c41f4a39",
  skin: cailin05Skin,
  role: "Admin",
  tier: "admin",
  hoverAnimation: "moonwalk",
};

const saidaiV: TeamMember = {
  username: "Saidai_V",
  uuid: "2d6b2f99-34ae-4c25-acda-dca5e5def564",
  skin: saidaiVSkin,
  role: "Admin",
  tier: "admin",
  hoverAnimation: "explode",
};

export const PODIUM = {
  left: [tetsuoken, saidaiV],
  center: [agent772, saunhardy, theBigShot],
  right: [diablothe2nd, cailin05],
} as const;

export const TEAM_SIZE =
  PODIUM.left.length + PODIUM.center.length + PODIUM.right.length;

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
      mobile: { width: 72, height: 108 },
    },
    badgeClass: "bg-[#e36009]/20 text-[#e36009] border-[#e36009]/30",
  },
} as const;
