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
import { computeBBox, fitFontSize } from "@/utils/canvas";
import {
  W,
  H,
  BG_BOT,
  AMBER,
  FOREGROUND,
  MUTED,
  TEXT_X,
  registerBrandFonts,
  drawImageCover,
  paintEllipseGradient,
  paintFigure,
  paintUrlChip,
  paintWordmark,
  wrapText,
} from "@/utils/og-card";
import {
  ASSETS,
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
const TEAM: readonly MemberSpec[] = [
  {
    username: "Tetsuoken",
    uuid: "32ff995f-cf92-417b-b745-891738346120",
    pose: "wave",
    tier: "admin",
    centerX: 636,
    groundY: 598,
  },
  {
    username: "Saidai_V",
    uuid: "2d6b2f99-34ae-4c25-acda-dca5e5def564",
    pose: "cute",
    tier: "admin",
    centerX: 826,
    groundY: 478,
  },
  {
    username: "Agent772",
    uuid: "3e0db446-147a-4692-87fd-c3facc4341db",
    pose: "engineer",
    tier: "dev-admin",
    centerX: 752,
    groundY: 608,
  },
  {
    username: "saunhardy",
    uuid: "091b900c-4174-478c-900c-a0fe5a31a329",
    pose: "confidence",
    tier: "owner",
    centerX: 900,
    groundY: 618,
  },
  {
    username: "The_BigShot",
    uuid: "4cada83a-c012-4a31-8d80-942f3f79e8a1",
    pose: "crossed",
    tier: "dev-admin",
    centerX: 1014,
    groundY: 608,
  },
  {
    username: "diablothe2nd",
    uuid: "8cca5cab-b782-452b-a8b9-8bb4ae0f6d0f",
    pose: "gaze",
    tier: "admin",
    centerX: 986,
    groundY: 478,
  },
  {
    username: "Cailin05",
    uuid: "aee71815-6420-444c-a245-9047c41f4a39",
    pose: "cheer",
    tier: "admin",
    centerX: 1110,
    groundY: 598,
  },
];

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

  const backToFront = [...TEAM].sort((a, b) => a.groundY - b.groundY);
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

async function paintCopy(ctx: SKRSContext2D): Promise<void> {
  await paintWordmark(ctx);

  const maxTextWidth = 500;
  ctx.textBaseline = "alphabetic";

  const headFont = (s: number) => `700 ${s}px Outfit`;
  ctx.letterSpacing = "-1.4px";
  const headSize = fitFontSize(
    ctx,
    "behind the server.",
    headFont,
    [72, 66, 60],
    maxTextWidth,
  );
  const line1Y = 286;
  const line2Y = line1Y + headSize + 6;

  ctx.font = headFont(headSize);
  ctx.fillStyle = FOREGROUND;
  ctx.fillText("Meet the people", TEXT_X, line1Y);
  ctx.fillStyle = AMBER;
  ctx.fillText("behind the server.", TEXT_X, line2Y);
  ctx.letterSpacing = "0px";

  const subFont = "400 22px Outfit";
  const subLines = wrapText(
    ctx,
    "The owner, developers and admins who keep Createrington running.",
    subFont,
    380,
  );
  ctx.font = subFont;
  ctx.fillStyle = MUTED;
  let subY = line2Y + 52;
  for (const line of subLines) {
    ctx.fillText(line, TEXT_X, subY);
    subY += 31;
  }

  paintUrlChip(ctx, "createrington.com/team", TEXT_X, subY + 4);
}

async function main(): Promise<void> {
  const outPath = process.argv[2] ?? join(ASSETS, "og", "team.png");

  registerBrandFonts();
  await writeCard(outPath, async (ctx) => {
    await paintBackdrop(ctx);
    await paintTeam(ctx);
    await paintCopy(ctx);
  });
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
