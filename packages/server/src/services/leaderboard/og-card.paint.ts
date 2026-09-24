import type { Image, SKRSContext2D } from "@napi-rs/canvas";
import { formatCompactMoney } from "@createrington/shared/format";
import { fitFontSize } from "@/utils/canvas";
import {
  AMBER,
  BG_BOT,
  drawImageCover,
  FOREGROUND,
  H,
  loadServerAsset,
  MUTED,
  paintEllipseGradient,
  paintFigure,
  paintUrlChip,
  paintWordmark,
  roundRectPath,
  TEXT_X,
  W,
  wrapText,
} from "@/utils/og-card";
import type { TopRoleMetric } from "@/services/discord/role/top-role-holder.service";

export interface CardSlot {
  roleKey: string;
  label: string;
  metric: TopRoleMetric;
  holder: { username: string; value: number; figure: Image | null } | null;
}

export const SLOT_ORDER = ["the_sleepless", "the_unrivaled", "capitalist"];

const ROLE_RGB: Record<string, string> = {
  the_unrivaled: "76,141,255",
  the_sleepless: "130,107,194",
  capitalist: "245,166,35",
};
const FALLBACK_RGB = "161,161,170";

const GROUND_Y = 452;

const SLOTS = [
  {
    centerX: 698,
    height: 236,
    maxWidth: 164,
    nameWidth: 180,
    nameSizes: [28, 24, 20, 18],
  },
  {
    centerX: 888,
    height: 300,
    maxWidth: 206,
    nameWidth: 196,
    nameSizes: [32, 28, 24, 20, 18],
  },
  {
    centerX: 1078,
    height: 236,
    maxWidth: 164,
    nameWidth: 180,
    nameSizes: [28, 24, 20, 18],
  },
] as const;

const rgba = (rgb: string, alpha: number) => `rgba(${rgb},${alpha})`;

function formatMetric(metric: TopRoleMetric, value: number): string {
  switch (metric) {
    case "playtime":
      return `${Math.floor(value / 3600).toLocaleString("en-US")} hours`;
    case "balance":
      return formatCompactMoney(value);
    case "records":
      return `${value.toLocaleString("en-US")} ${value === 1 ? "record" : "records"}`;
  }
}

function truncate(ctx: SKRSContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return `${cut}…`;
}

async function paintBackdrop(ctx: SKRSContext2D): Promise<void> {
  ctx.fillStyle = BG_BOT;
  ctx.fillRect(0, 0, W, H);

  const hero = await loadServerAsset("og", "dark-warehouse.webp");
  ctx.save();
  ctx.filter = "grayscale(0.4) brightness(0.72) blur(3px)";
  drawImageCover(ctx, hero, 0, 0, W, H, "center");
  ctx.restore();

  const scrim = ctx.createLinearGradient(0, 0, 680, 0);
  scrim.addColorStop(0, "rgba(15,15,19,0.95)");
  scrim.addColorStop(0.6, "rgba(15,15,19,0.6)");
  scrim.addColorStop(1, "rgba(15,15,19,0.1)");
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, 680, H);

  const fade = ctx.createLinearGradient(0, H, 0, 0);
  fade.addColorStop(0, "rgba(11,11,14,0.92)");
  fade.addColorStop(0.35, "rgba(11,11,14,0.5)");
  fade.addColorStop(1, "rgba(11,11,14,0.05)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, W, H);

  paintEllipseGradient(ctx, 600, 315, 900, 470, [
    [0.45, "rgba(6,6,8,0)"],
    [1, "rgba(6,6,8,0.6)"],
  ]);
}

function paintSlotGlows(ctx: SKRSContext2D, slots: (CardSlot | null)[]): void {
  slots.forEach((slot, index) => {
    if (!slot) return;
    const rgb = ROLE_RGB[slot.roleKey] ?? FALLBACK_RGB;
    const { centerX, height } = SLOTS[index];
    paintEllipseGradient(
      ctx,
      centerX,
      GROUND_Y - height * 0.45,
      height * 0.55,
      height * 0.6,
      [
        [0, rgba(rgb, 0.2)],
        [0.6, rgba(rgb, 0.06)],
        [1, rgba(rgb, 0)],
      ],
    );
  });

  const line = ctx.createLinearGradient(590, 0, 1182, 0);
  line.addColorStop(0, "rgba(255,255,255,0)");
  line.addColorStop(0.5, "rgba(255,255,255,0.14)");
  line.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = line;
  ctx.fillRect(590, GROUND_Y + 6, 592, 1);
}

function paintFigures(ctx: SKRSContext2D, slots: (CardSlot | null)[]): void {
  slots.forEach((slot, index) => {
    if (!slot) return;
    const figure = slot.holder?.figure;
    if (!figure) return;
    const rgb = ROLE_RGB[slot.roleKey] ?? FALLBACK_RGB;
    const { centerX, height, maxWidth } = SLOTS[index];
    paintFigure(
      ctx,
      figure,
      { centerX, height, maxWidth, groundY: GROUND_Y },
      {
        glow: rgba(rgb, 0.45),
        glowBlur: 18,
        shadowScale: 0.55,
        shadowRy: 10,
        shadowAlpha: 0.6,
      },
    );
  });
}

function paintPill(
  ctx: SKRSContext2D,
  text: string,
  rgb: string,
  centerX: number,
  y: number,
): void {
  const pillH = 28;
  const padX = 14;
  ctx.font = "600 13px Outfit";
  ctx.letterSpacing = "2.6px";
  const textW = ctx.measureText(text).width;
  const pillW = textW + padX * 2;
  const x = centerX - pillW / 2;

  ctx.fillStyle = rgba(rgb, 0.12);
  roundRectPath(ctx, x, y, pillW, pillH, pillH / 2);
  ctx.fill();
  ctx.strokeStyle = rgba(rgb, 0.5);
  ctx.lineWidth = 1;
  roundRectPath(ctx, x + 0.5, y + 0.5, pillW - 1, pillH - 1, pillH / 2 - 0.5);
  ctx.stroke();

  ctx.fillStyle = `rgb(${rgb})`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(text, x + padX + 1.3, y + pillH / 2 + 1);
  ctx.letterSpacing = "0px";
  ctx.textBaseline = "alphabetic";
}

function paintCaptions(ctx: SKRSContext2D, slots: (CardSlot | null)[]): void {
  slots.forEach((slot, index) => {
    if (!slot) return;
    const rgb = ROLE_RGB[slot.roleKey] ?? FALLBACK_RGB;
    const { centerX, nameSizes, nameWidth } = SLOTS[index];
    const pillY = GROUND_Y + 24;
    paintPill(ctx, slot.label.toUpperCase(), rgb, centerX, pillY);

    const name = slot.holder?.username ?? "Unclaimed";
    const nameFont = (size: number) => `700 ${size}px Outfit`;
    const nameSize = fitFontSize(ctx, name, nameFont, nameSizes, nameWidth);
    const nameY = pillY + 28 + 14 + nameSize * 0.8;
    ctx.textAlign = "center";
    ctx.font = nameFont(nameSize);
    ctx.fillStyle = slot.holder ? FOREGROUND : MUTED;
    ctx.fillText(truncate(ctx, name, nameWidth), centerX, nameY);

    if (slot.holder) {
      ctx.font = "500 19px Outfit";
      ctx.fillStyle = `rgb(${rgb})`;
      ctx.fillText(
        formatMetric(slot.metric, slot.holder.value),
        centerX,
        nameY + 28,
      );
    }
    ctx.textAlign = "left";
  });
}

async function paintCopy(ctx: SKRSContext2D): Promise<void> {
  await paintWordmark(ctx);

  ctx.textBaseline = "alphabetic";
  const headFont = (size: number) => `700 ${size}px Outfit`;
  ctx.letterSpacing = "-1.4px";
  const headSize = fitFontSize(
    ctx,
    "One holder each.",
    headFont,
    [68, 62, 56],
    480,
  );
  const line1Y = 286;
  const line2Y = line1Y + headSize + 6;

  ctx.font = headFont(headSize);
  ctx.fillStyle = FOREGROUND;
  ctx.fillText("Three titles.", TEXT_X, line1Y);
  ctx.fillStyle = AMBER;
  ctx.fillText("One holder each.", TEXT_X, line2Y);
  ctx.letterSpacing = "0px";

  const subFont = "400 22px Outfit";
  const subLines = wrapText(
    ctx,
    "Most hours, most records, deepest pockets. Awarded again every midnight UTC.",
    subFont,
    440,
  );
  ctx.font = subFont;
  ctx.fillStyle = MUTED;
  let subY = line2Y + 52;
  for (const line of subLines) {
    ctx.fillText(line, TEXT_X, subY);
    subY += 31;
  }

  paintUrlChip(ctx, "createrington.com/leaderboards", TEXT_X, subY + 4);
}

export async function paintLeaderboardsCard(
  ctx: SKRSContext2D,
  slots: (CardSlot | null)[],
): Promise<void> {
  await paintBackdrop(ctx);
  paintSlotGlows(ctx, slots);
  paintFigures(ctx, slots);
  paintCaptions(ctx, slots);
  await paintCopy(ctx);
}
