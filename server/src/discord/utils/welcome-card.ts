import { AttachmentBuilder, GuildMember } from "discord.js";
import { createCanvas, loadImage } from "canvas";

interface WelcomeCardConfig {
  backgroundColor: string;
  accentColor: string;
  textColor: string;
  secondaryTextColor: string;
}

const DEFAULT_CONFIG: WelcomeCardConfig = {
  backgroundColor: "#2C2F33",
  accentColor: "#7289DA",
  textColor: "#FFFFFF",
  secondaryTextColor: "#99AAB5",
};

export async function generateWelcomeCard(
  member: GuildMember,
  memberCount: number,
  config: Partial<WelcomeCardConfig> = {}
): Promise<AttachmentBuilder> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const width = 1600;
  const height = 900;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, finalConfig.backgroundColor);
  gradient.addColorStop(1, adjustBrightness(finalConfig.backgroundColor, -20));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.globalAlpha = 0.1;
  ctx.fillStyle = finalConfig.accentColor;
  ctx.beginPath();
  ctx.arc(width - 200, 100, 240, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(200, height - 100, 160, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1.0;

  const avatarURL = member.user.displayAvatarURL({
    extension: "png",
    size: 512,
  });

  try {
    const avatar = await loadImage(avatarURL);
    const avatarSize = 300;
    const avatarX = 200;
    const avatarY = height / 2;

    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.shadowBlur = 40;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 20;

    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarSize / 2 + 10, 0, Math.PI * 2);
    ctx.fillStyle = finalConfig.accentColor;
    ctx.fill();

    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(
      avatar,
      avatarX - avatarSize / 2,
      avatarY - avatarSize / 2,
      avatarSize,
      avatarSize
    );
    ctx.restore();
  } catch (error) {
    logger.error("Failed to load avatar for welcome card:", error);
    ctx.beginPath();
    ctx.arc(200, height / 2, 150, 0, Math.PI * 2);
    ctx.fillStyle = finalConfig.accentColor;
    ctx.fill();
  }

  const textX = 560;
  ctx.font = "bold 56px Arial, sans-serif";
  ctx.fillStyle = finalConfig.accentColor;
  ctx.fillText("WELCOME", textX, 160);

  ctx.font = "bold 96px Arial, sans-serif";
  ctx.fillStyle = finalConfig.textColor;
  const username =
    member.user.username.length > 15
      ? member.user.username.substring(0, 15) + "..."
      : member.user.username;
  ctx.fillText(username, textX, 280);

  ctx.font = "64px Arial, sans-serif";
  ctx.fillStyle = finalConfig.secondaryTextColor;
  ctx.fillText(`Member #${memberCount}`, textX, 370);

  const buffer = canvas.toBuffer("image/png");
  return new AttachmentBuilder(buffer, { name: "welcome.png" });
}

function adjustBrightness(color: string, amount: number): string {
  const hex = color.replace("#", "");
  const num = parseInt(hex, 16);
  let r = (num >> 16) + amount;
  let g = ((num >> 8) & 0x00ff) + amount;
  let b = (num & 0x0000ff) + amount;
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function drawTextWithStroke(
  ctx: any,
  text: string,
  x: number,
  y: number,
  fillColor: string,
  strokeColor: string = "rgba(0, 0, 0, 0.8)",
  strokeWidth: number = 4
) {
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = strokeWidth;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fillColor;
  ctx.fillText(text, x, y);
}

export async function generateCustomWelcomeCard(
  member: GuildMember,
  memberCount: number,
  options: {
    backgroundImageURL?: string;
    message?: string;
    config?: Partial<WelcomeCardConfig>;
  } = {}
): Promise<AttachmentBuilder> {
  const finalConfig = { ...DEFAULT_CONFIG, ...options.config };
  const width = 1600;
  const height = 900;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  if (options.backgroundImageURL) {
    try {
      const background = await loadImage(options.backgroundImageURL);
      ctx.drawImage(background, 0, 0, width, height);
      ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
      ctx.fillRect(0, 0, width, height);
    } catch (error) {
      logger.error("Failed to load background image:", error);
      ctx.fillStyle = finalConfig.backgroundColor;
      ctx.fillRect(0, 0, width, height);
    }
  } else {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, finalConfig.backgroundColor);
    gradient.addColorStop(
      1,
      adjustBrightness(finalConfig.backgroundColor, -20)
    );
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  const avatarURL = member.user.displayAvatarURL({
    extension: "png",
    size: 512,
  });

  try {
    const avatar = await loadImage(avatarURL);
    const avatarSize = 360;
    const avatarX = 240;
    const avatarY = height / 2;

    ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
    ctx.shadowBlur = 50;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 24;

    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarSize / 2 + 12, 0, Math.PI * 2);
    ctx.fillStyle = finalConfig.accentColor;
    ctx.fill();

    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(
      avatar,
      avatarX - avatarSize / 2,
      avatarY - avatarSize / 2,
      avatarSize,
      avatarSize
    );
    ctx.restore();
  } catch (error) {
    logger.error("Failed to load avatar:", error);
  }

  const textX = 640;
  const welcomeSize = 64;
  const usernameSize = 104;
  const memberSize = 72;
  const spacing = 50;

  const totalHeight = welcomeSize + usernameSize + memberSize + spacing * 2;
  const startY = (height - totalHeight) / 2 + welcomeSize;

  ctx.font = "bold 64px Impact, Arial Black, sans-serif";
  drawTextWithStroke(
    ctx,
    "WELCOME",
    textX,
    startY,
    "#F37B0B",
    "rgba(0, 0, 0, 0.9)",
    10
  );

  ctx.font = "bold 104px Impact, Arial Black, sans-serif";
  const username =
    member.user.username.length > 12
      ? member.user.username.substring(0, 12) + "..."
      : member.user.username;
  drawTextWithStroke(
    ctx,
    username,
    textX,
    startY + spacing + usernameSize,
    "#FFFFFF",
    "rgba(0, 0, 0, 0.9)",
    12
  );

  ctx.font = "72px Impact, Arial Black, sans-serif";
  const memberText = `Member #${memberCount}`;
  drawTextWithStroke(
    ctx,
    memberText,
    textX,
    startY + spacing + usernameSize + spacing + memberSize,
    "#CCCCCC",
    "rgba(0, 0, 0, 0.9)",
    8
  );

  const buffer = canvas.toBuffer("image/png");
  return new AttachmentBuilder(buffer, { name: "welcome.png" });
}
