import { AttachmentBuilder, GuildMember } from "discord.js";
import { createCanvas, loadImage, registerFont } from "canvas";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Configuration for the welcome card appearance
 */
interface WelcomeCardConfig {
  /** Background color or gradient */
  backgroundColor: string;
  /** Accent color for text and decorations */
  accentColor: string;
  /** Text color */
  textColor: string;
  /** Secondary text color */
  secondaryTextColor: string;
}

/**
 * Default theme configuration
 */
const DEFAULT_CONFIG: WelcomeCardConfig = {
  backgroundColor: "#2C2F33", // Discord dark theme
  accentColor: "#7289DA", // Discord blurple
  textColor: "#FFFFFF",
  secondaryTextColor: "#99AAB5",
};

/**
 * Generates a welcome card image for a new member
 *
 * Creates a custom image featuring:
 * - User's profile picture (circular)
 * - Username and discriminator
 * - Member join number
 * - Custom background and styling
 *
 * @param member - The guild member who joined
 * @param memberCount - The total member count (join position)
 * @param config - Optional custom styling configuration
 * @returns AttachmentBuilder containing the generated welcome image
 *
 * @example
 * const welcomeImage = await generateWelcomeCard(member, 142);
 * await channel.send({ files: [welcomeImage] });
 */
export async function generateWelcomeCard(
  member: GuildMember,
  memberCount: number,
  config: Partial<WelcomeCardConfig> = {}
): Promise<AttachmentBuilder> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  // Canvas dimensions
  const width = 800;
  const height = 300;

  // Create canvas
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Draw background with gradient
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, finalConfig.backgroundColor);
  gradient.addColorStop(1, adjustBrightness(finalConfig.backgroundColor, -20));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Draw decorative circles in background
  ctx.globalAlpha = 0.1;
  ctx.fillStyle = finalConfig.accentColor;
  ctx.beginPath();
  ctx.arc(width - 100, 50, 120, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(100, height - 50, 80, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1.0;

  // Load and draw avatar
  const avatarURL = member.user.displayAvatarURL({
    extension: "png",
    size: 256,
  });

  try {
    const avatar = await loadImage(avatarURL);

    // Draw avatar circle
    const avatarSize = 150;
    const avatarX = 100;
    const avatarY = height / 2;

    // Draw shadow for avatar
    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.shadowBlur = 20;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 10;

    // Draw avatar border
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarSize / 2 + 5, 0, Math.PI * 2);
    ctx.fillStyle = finalConfig.accentColor;
    ctx.fill();

    // Reset shadow
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Clip and draw avatar
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
    // Draw placeholder circle if avatar fails to load
    ctx.beginPath();
    ctx.arc(100, height / 2, 75, 0, Math.PI * 2);
    ctx.fillStyle = finalConfig.accentColor;
    ctx.fill();
  }

  // Draw text content
  const textX = 280;

  // "WELCOME" text
  ctx.font = "bold 28px Arial, sans-serif";
  ctx.fillStyle = finalConfig.accentColor;
  ctx.fillText("WELCOME", textX, 80);

  // Username
  ctx.font = "bold 48px Arial, sans-serif";
  ctx.fillStyle = finalConfig.textColor;
  const username =
    member.user.username.length > 15
      ? member.user.username.substring(0, 15) + "..."
      : member.user.username;
  ctx.fillText(username, textX, 140);

  // Member count
  ctx.font = "32px Arial, sans-serif";
  ctx.fillStyle = finalConfig.secondaryTextColor;
  ctx.fillText(`Member #${memberCount}`, textX, 185);

  // Server name
  ctx.font = "20px Arial, sans-serif";
  ctx.fillStyle = finalConfig.secondaryTextColor;
  const serverName =
    member.guild.name.length > 30
      ? member.guild.name.substring(0, 30) + "..."
      : member.guild.name;
  ctx.fillText(`Welcome to ${serverName}!`, textX, 225);

  // Convert to buffer and create attachment
  const buffer = canvas.toBuffer("image/png");
  const attachment = new AttachmentBuilder(buffer, {
    name: "welcome.png",
  });

  return attachment;
}

/**
 * Helper function to adjust color brightness
 *
 * @param color - Hex color string (e.g., "#FF0000")
 * @param amount - Amount to adjust brightness (-100 to 100)
 * @returns Adjusted hex color string
 */
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

/**
 * Creates a custom welcome card with advanced styling options
 *
 * @param member - The guild member who joined
 * @param memberCount - The member join position
 * @param options - Advanced customization options
 * @param options.backgroundImageURL - Optional URL to a background image
 * @param options.message - Custom welcome message
 * @param options.config - Color configuration
 * @returns AttachmentBuilder containing the generated image
 */
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
  const width = 800;
  const height = 300;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Draw background image if provided
  if (options.backgroundImageURL) {
    try {
      const background = await loadImage(options.backgroundImageURL);
      ctx.drawImage(background, 0, 0, width, height);

      // Add dark overlay for better text visibility
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.fillRect(0, 0, width, height);
    } catch (error) {
      logger.error("Failed to load background image:", error);
      // Fallback to solid color
      ctx.fillStyle = finalConfig.backgroundColor;
      ctx.fillRect(0, 0, width, height);
    }
  } else {
    // Use gradient background
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, finalConfig.backgroundColor);
    gradient.addColorStop(
      1,
      adjustBrightness(finalConfig.backgroundColor, -20)
    );
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  // Draw avatar with same logic as before
  const avatarURL = member.user.displayAvatarURL({
    extension: "png",
    size: 256,
  });

  try {
    const avatar = await loadImage(avatarURL);
    const avatarSize = 150;
    const avatarX = 100;
    const avatarY = height / 2;

    ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
    ctx.shadowBlur = 20;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 10;

    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarSize / 2 + 5, 0, Math.PI * 2);
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

  // Draw text
  const textX = 280;

  ctx.font = "bold 28px Arial, sans-serif";
  ctx.fillStyle = finalConfig.accentColor;
  ctx.fillText("WELCOME", textX, 80);

  ctx.font = "bold 48px Arial, sans-serif";
  ctx.fillStyle = finalConfig.textColor;
  const username =
    member.user.username.length > 15
      ? member.user.username.substring(0, 15) + "..."
      : member.user.username;
  ctx.fillText(username, textX, 140);

  ctx.font = "32px Arial, sans-serif";
  ctx.fillStyle = finalConfig.secondaryTextColor;
  ctx.fillText(`Member #${memberCount}`, textX, 185);

  // Custom message or default
  const welcomeMessage = options.message || `Welcome to ${member.guild.name}!`;
  ctx.font = "20px Arial, sans-serif";
  ctx.fillStyle = finalConfig.secondaryTextColor;
  ctx.fillText(welcomeMessage, textX, 225);

  const buffer = canvas.toBuffer("image/png");
  return new AttachmentBuilder(buffer, { name: "welcome.png" });
}
