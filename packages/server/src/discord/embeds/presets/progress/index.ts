import type { ColorResolvable } from "discord.js";
import { createEmbed, DiscordEmbedBuilder } from "../../embed-builder";
import { EmbedColors } from "../../colors";

export interface ProgressStep {
  name: string;
  completed: boolean;
  error?: string;
  timestamp?: Date;
}

export interface ProgressOptions {
  /** Main title of the embed */
  title: string;
  /** Optional description */
  description?: string;
  /** Progress steps */
  steps: ProgressStep[];
  /** Current step index (for in-progress indicators) */
  currentStepIndex?: number;
  /**Show percentage */
  showPercentage?: boolean;
  /** Show progress bar */
  showProgressBar?: boolean;
  /** Progress bar length (default: 12) */
  progressBarLength?: number;
  /** Color override (auto-selects based on completion if not provided) */
  color?: ColorResolvable;
  /** Additional fields to add*/
  additionalFields?: Array<{ name: string; value: string; inline?: boolean }>;
  /** Footer text */
  footer?: string;
  /** Show timestamp */
  showTimestamp?: boolean;
}

export const ProgressEmbedPresets = {
  /**
   * Creates a general progress embed
   */
  create(options: ProgressOptions): DiscordEmbedBuilder {
    const {
      title,
      description,
      steps,
      currentStepIndex,
      showPercentage = true,
      showProgressBar = true,
      progressBarLength = 12,
      color,
      additionalFields = [],
      footer,
      showTimestamp = true,
    } = options;

    const total = steps.length;
    const completed = steps.filter((s) => s.completed).length;
    const percent = Math.round((completed / total) * 100);

    let progressBar = "";
    if (showProgressBar) {
      const filled = Math.floor((completed / total) * progressBarLength);
      progressBar = "▰".repeat(filled) + "▱".repeat(progressBarLength - filled);
    }

    let progressText = "";
    if (showProgressBar && showPercentage) {
      progressText = `${progressBar}  **${percent}%**  (${completed}/${total})`;
    } else if (showProgressBar) {
      progressText = `${progressBar}  (${completed}/${total})`;
    } else if (showPercentage) {
      progressText = `**${percent}%**  (${completed}/${total})`;
    } else {
      progressText = `(${completed}/${total})`;
    }

    const stepsText = steps
      .map((s, i) => {
        let icon = "·";
        if (s.error) {
          icon = "❌";
        } else if (s.completed) {
          icon = "✓";
        } else if (i === currentStepIndex) {
          icon = "⏳";
        }
        return `${icon} ${s.name}`;
      })
      .join("\n");

    let embedColor = color;
    if (!embedColor) {
      const hasError = steps.some((s) => s.error);
      if (hasError) {
        embedColor = EmbedColors.Error;
      } else if (percent === 100) {
        embedColor = EmbedColors.Success;
      } else {
        embedColor = EmbedColors.Info;
      }
    }

    const embed = createEmbed().title(title).color(embedColor);

    const fullDescription = description
      ? `${description}\n\n${progressText}`
      : progressText;
    embed.description(fullDescription);

    embed.field("Progress", stepsText, false);

    if (additionalFields.length > 0) {
      embed.fields(additionalFields);
    }

    if (footer) {
      embed.footer(footer);
    }

    if (showTimestamp) {
      embed.timestamp();
    }

    return embed;
  },

  /**
   * Creates a simple progress embed (just bar and percentage)
   */
  simple(options: {
    title: string;
    completed: number;
    total: number;
    description?: string;
  }): DiscordEmbedBuilder {
    const { title, completed, total, description } = options;
    const percent = Math.round((completed / total) * 100);

    const barLen = 12;
    const filled = Math.round((completed / total) * barLen);
    const bar = "▰".repeat(filled) + "▱".repeat(barLen - filled);

    const embed = createEmbed()
      .title(title)
      .description(
        description
          ? `${description}\n\n${bar}  **${percent}%**`
          : `${bar}  **${percent}%**`,
      )
      .color(percent === 100 ? EmbedColors.Success : EmbedColors.Info);

    return embed;
  },

  /**
   * Creates a loading/processing embed with animated progress
   */
  loading(message: string = "Processing..."): DiscordEmbedBuilder {
    return createEmbed()
      .title("⏳ Please wait")
      .description(message)
      .color(EmbedColors.Info);
  },

  /**
   * Creates a completion embed
   */
  complete(title: string, description?: string): DiscordEmbedBuilder {
    const embed = createEmbed().title(`✅ ${title}`).color(EmbedColors.Success);

    if (description) {
      embed.description(description);
    }

    return embed;
  },

  /**
   * Creates a failed/error embed
   */
  error(
    title: string,
    error: string,
    failedStep?: string,
  ): DiscordEmbedBuilder {
    const embed = createEmbed()
      .title(`❌ ${title}`)
      .description(error)
      .color(EmbedColors.Error);

    if (failedStep) {
      embed.field("Failed at", failedStep, false);
    }

    return embed;
  },
};
