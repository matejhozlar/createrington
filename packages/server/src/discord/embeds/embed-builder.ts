import { EmbedBuilder, type ColorResolvable } from "discord.js";
/**
 * Fluent interface for building Discord embeds with sensible defaults
 *
 * Provides a clean, chainable API for creating embeds throughout the app.
 * All setter methods return `this` for chaining; call `build()` to get the final EmbedBuilder.
 */
export class DiscordEmbedBuilder {
  private embed: EmbedBuilder;

  constructor() {
    this.embed = new EmbedBuilder();
  }

  public title(text: string): this {
    this.embed.setTitle(text);
    return this;
  }

  public description(text: string): this {
    this.embed.setDescription(text);
    return this;
  }

  public color(color: ColorResolvable): this {
    this.embed.setColor(color);
    return this;
  }

  public field(name: string, value: string, inline: boolean = false): this {
    this.embed.addFields({ name, value, inline });
    return this;
  }

  public fields(
    fields: Array<{ name: string; value: string; inline?: boolean }>,
  ): this {
    this.embed.addFields(fields);
    return this;
  }

  public footer(text: string, iconURL?: string): this {
    this.embed.setFooter({ text, iconURL });
    return this;
  }

  public author(name: string, iconURL?: string, url?: string): this {
    this.embed.setAuthor({ name, iconURL, url });
    return this;
  }

  public thumbnail(url: string): this {
    this.embed.setThumbnail(url);
    return this;
  }

  public image(url: string): this {
    this.embed.setImage(url);
    return this;
  }

  public url(url: string): this {
    this.embed.setURL(url);
    return this;
  }

  public timestamp(date?: Date | number): this {
    this.embed.setTimestamp(date);
    return this;
  }

  /** Removes any previously set timestamp */
  public noTimestamp(): this {
    this.embed.setTimestamp(null);
    return this;
  }

  /** Returns the underlying discord.js EmbedBuilder instance */
  public build(): EmbedBuilder {
    return this.embed;
  }
}

/** Shorthand factory for creating a new DiscordEmbedBuilder instance */
export function createEmbed(): DiscordEmbedBuilder {
  return new DiscordEmbedBuilder();
}
