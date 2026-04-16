import { describe, it, expect } from "vitest";
import { EmbedBuilder } from "discord.js";
import {
  DiscordEmbedBuilder,
  createEmbed,
} from "@/discord/embeds/embed-builder";

describe("DiscordEmbedBuilder", () => {
  it("createEmbed() returns a fresh DiscordEmbedBuilder instance", () => {
    expect(createEmbed()).toBeInstanceOf(DiscordEmbedBuilder);
  });

  it("build() returns the underlying discord.js EmbedBuilder", () => {
    expect(createEmbed().build()).toBeInstanceOf(EmbedBuilder);
  });

  it("setters return `this` to support fluent chaining", () => {
    const builder = createEmbed();
    expect(builder.title("t")).toBe(builder);
    expect(builder.description("d")).toBe(builder);
    expect(builder.color(0xff0000)).toBe(builder);
    expect(builder.field("n", "v")).toBe(builder);
    expect(builder.footer("f")).toBe(builder);
    expect(builder.author("a")).toBe(builder);
    expect(builder.thumbnail("https://example.com/t.png")).toBe(builder);
    expect(builder.image("https://example.com/i.png")).toBe(builder);
    expect(builder.url("https://example.com")).toBe(builder);
    expect(builder.timestamp(new Date())).toBe(builder);
    expect(builder.noTimestamp()).toBe(builder);
  });

  describe("setter behavior", () => {
    it("title + description show up in the built embed", () => {
      const data = createEmbed()
        .title("Hello")
        .description("world")
        .build().data;
      expect(data.title).toBe("Hello");
      expect(data.description).toBe("world");
    });

    it("color is stored as the resolved integer", () => {
      const data = createEmbed().color(0xff0000).build().data;
      expect(data.color).toBe(0xff0000);
    });

    it("field() appends a single field with inline default false", () => {
      const data = createEmbed().field("Name", "Value").build().data;
      expect(data.fields).toEqual([
        { name: "Name", value: "Value", inline: false },
      ]);
    });

    it("field() respects an explicit inline=true", () => {
      const data = createEmbed().field("Name", "Value", true).build().data;
      expect(data.fields?.[0].inline).toBe(true);
    });

    it("fields() appends multiple fields and preserves order", () => {
      const data = createEmbed()
        .fields([
          { name: "A", value: "1" },
          { name: "B", value: "2", inline: true },
        ])
        .build().data;
      expect(data.fields).toEqual([
        { name: "A", value: "1" },
        { name: "B", value: "2", inline: true },
      ]);
    });

    it("field() calls accumulate", () => {
      const data = createEmbed()
        .field("A", "1")
        .field("B", "2", true)
        .build().data;
      expect(data.fields).toHaveLength(2);
    });

    it("footer + author + thumbnail + image + url all populate the right keys", () => {
      const data = createEmbed()
        .footer("Footer text", "https://example.com/footer.png")
        .author("Author", "https://example.com/icon.png", "https://example.com")
        .thumbnail("https://example.com/t.png")
        .image("https://example.com/i.png")
        .url("https://example.com/x")
        .build().data;

      expect(data.footer).toEqual({
        text: "Footer text",
        icon_url: "https://example.com/footer.png",
      });
      expect(data.author).toMatchObject({ name: "Author" });
      expect(data.thumbnail?.url).toBe("https://example.com/t.png");
      expect(data.image?.url).toBe("https://example.com/i.png");
      expect(data.url).toBe("https://example.com/x");
    });

    it("timestamp(date) sets a timestamp string and noTimestamp() clears it", () => {
      const builder = createEmbed().timestamp(new Date("2026-04-16T00:00:00Z"));
      expect(builder.build().data.timestamp).toBeDefined();

      builder.noTimestamp();
      expect(builder.build().data.timestamp).toBeUndefined();
    });
  });
});
