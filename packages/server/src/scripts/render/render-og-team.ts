// Headless tool: composites the /team social card (team.png), a canvas
// rebuild of the team page: the gondola station hero under the page's
// grayscale + fade treatment, and the whole team gathered for a group shot in
// the page's line-up order, the owner tallest in the middle. Figures come from
// the committed cache under assets/figures/ (shared with every other og card,
// keyed by username and pose); to refresh one, delete it and re-run with
// SKIN_API_KEY set.
//
// Run: pnpm --filter @createrington/server util:render-og-team [outPath]

import { join } from "node:path";

import { loadImage, type SKRSContext2D } from "@napi-rs/canvas";
import { computeBBox } from "@/utils/canvas";
import {
  W,
  H,
  BG_BOT,
  registerBrandFonts,
  drawImageCover,
  paintEllipseGradient,
  paintFigure,
  paintHeadlineCopy,
  type HeadlineCopy,
} from "@/utils/og-card";
import {
  ASSETS,
  TEAM,
  getPoseFigure,
  writeCard,
  type PoseFigureRequest,
} from "./og-shared";

const amber = (a: number) => `rgba(255,185,0,${a})`;

type Tier = "owner" | "dev-admin" | "admin";

// Card pixels per render pixel. Every pose comes back at one camera scale, so
// a scale per tier keeps bodies the same size whatever the arms are doing, and
// steps the tiers down like TIER_CONFIG does on the page.
const TIER_SCALE: Record<Tier, number> = {
  owner: 0.268,
  "dev-admin": 0.235,
  admin: 0.202,
};

interface MemberSpec extends PoseFigureRequest {
  tier: Tier;
  centerX: number;
  groundY: number;
}

// Left to right as on the page. A lower groundY stands further back and is
// painted first: five share the floor with the owner out front, and the two
// at 478 look over the front row's shoulders.
const MEMBERS: readonly MemberSpec[] = [
  {
    ...TEAM.Tetsuoken,
    pose: "wave",
    tier: "admin",
    centerX: 636,
    groundY: 598,
  },
  {
    ...TEAM.Saidai_V,
    pose: "cute",
    tier: "admin",
    centerX: 826,
    groundY: 478,
  },
  {
    ...TEAM.Agent772,
    pose: "engineer",
    tier: "dev-admin",
    centerX: 752,
    groundY: 608,
  },
  {
    ...TEAM.saunhardy,
    pose: "confidence",
    tier: "owner",
    centerX: 900,
    groundY: 618,
  },
  {
    ...TEAM.The_BigShot,
    pose: "crossed",
    tier: "dev-admin",
    centerX: 1014,
    groundY: 608,
  },
  {
    ...TEAM.diablothe2nd,
    pose: "gaze",
    tier: "admin",
    centerX: 986,
    groundY: 478,
  },
  {
    ...TEAM.Cailin05,
    pose: "cheer",
    tier: "admin",
    centerX: 1110,
    groundY: 598,
  },
];

const COPY: HeadlineCopy = {
  lead: "Meet the people",
  accent: "behind the server.",
  sub: "The owner, developers and admins who keep Createrington running.",
  subWidth: 380,
  url: "createrington.com/team",
};

// The page hero treatment from PageHeader: grayscale-50 over the gondola
// station, a black/50 overlay, and the bottom fade into the page background.
async function paintBackdrop(ctx: SKRSContext2D): Promise<void> {
  ctx.fillStyle = BG_BOT;
  ctx.fillRect(0, 0, W, H);

  const hero = await loadImage(join(ASSETS, "hero", "gondola-station.webp"));
  ctx.save();
  ctx.filter = "grayscale(0.5) brightness(0.72) blur(3px)";
  drawImageCover(ctx, hero, 0, 0, W, H, "center");
  ctx.restore();

  const scrim = ctx.createLinearGradient(0, 0, 700, 0);
  scrim.addColorStop(0, "rgba(15,15,19,0.95)");
  scrim.addColorStop(0.55, "rgba(15,15,19,0.62)");
  scrim.addColorStop(1, "rgba(15,15,19,0.12)");
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, 700, H);

  const fade = ctx.createLinearGradient(0, H, 0, 0);
  fade.addColorStop(0, "rgba(11,11,14,0.9)");
  fade.addColorStop(0.35, "rgba(11,11,14,0.45)");
  fade.addColorStop(0.8, "rgba(11,11,14,0.08)");
  fade.addColorStop(1, "rgba(11,11,14,0)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, W, H);

  paintEllipseGradient(ctx, 600, 315, 900, 470, [
    [0.45, "rgba(6,6,8,0)"],
    [1, "rgba(6,6,8,0.6)"],
  ]);
}

async function paintTeam(ctx: SKRSContext2D): Promise<void> {
  paintEllipseGradient(ctx, 880, 440, 380, 250, [
    [0, "rgba(255,214,150,0.14)"],
    [0.6, "rgba(255,214,150,0.04)"],
    [1, "rgba(255,214,150,0)"],
  ]);

  const backToFront = [...MEMBERS].sort((a, b) => a.groundY - b.groundY);
  for (const member of backToFront) {
    const img = await getPoseFigure({ ...member, style: "cel" });
    const bbox = computeBBox(img);
    if (!bbox) throw new Error(`Empty figure render for ${member.username}`);
    paintFigure(
      ctx,
      img,
      {
        height: bbox.height * TIER_SCALE[member.tier],
        centerX: member.centerX,
        groundY: member.groundY,
      },
      {
        glow: amber(0.32),
        glowBlur: 14,
        shadowScale: 0.6,
        shadowRy: 10,
        shadowAlpha: 0.55,
      },
    );
  }
}

async function main(): Promise<void> {
  const outPath = process.argv[2] ?? join(ASSETS, "og", "team.png");

  registerBrandFonts();
  await writeCard(outPath, async (ctx) => {
    await paintBackdrop(ctx);
    await paintTeam(ctx);
    await paintHeadlineCopy(ctx, COPY);
  });
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
