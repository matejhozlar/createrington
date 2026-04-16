import { describe, it, expect } from "vitest";
import { CommonEmbedPresets } from "@/discord/embeds/presets/common";
import { EmbedColors } from "@/discord/embeds/colors";

describe("CommonEmbedPresets.success", () => {
  it("uses the green Success color and a check mark prefix", () => {
    const data = CommonEmbedPresets.success("Done").build().data;
    expect(data.title).toBe("✅ Done");
    expect(data.color).toBe(EmbedColors.Success);
  });

  it("omits the description when none is provided", () => {
    const data = CommonEmbedPresets.success("Done").build().data;
    expect(data.description).toBeUndefined();
  });

  it("includes the description when provided", () => {
    const data = CommonEmbedPresets.success("Done", "saved").build().data;
    expect(data.description).toBe("saved");
  });
});

describe("CommonEmbedPresets.error", () => {
  it("uses the red Error color and a cross prefix", () => {
    const data = CommonEmbedPresets.error("Oops").build().data;
    expect(data.title).toBe("❌ Oops");
    expect(data.color).toBe(EmbedColors.Error);
  });
});

describe("CommonEmbedPresets.errorWithAdmin", () => {
  it("appends the admin contact prompt when a description is provided", () => {
    const data = CommonEmbedPresets.errorWithAdmin(
      "Failure",
      "Something broke",
    ).build().data;
    expect(data.description).toContain("Something broke");
    expect(data.description).toContain("contact");
  });

  it("uses just the admin contact prompt when no description is provided", () => {
    const data = CommonEmbedPresets.errorWithAdmin("Failure").build().data;
    expect(data.description).toContain("contact");
  });
});

describe("CommonEmbedPresets.info", () => {
  it("uses the blue Info color and an info-circle prefix", () => {
    const data = CommonEmbedPresets.info("Heads up").build().data;
    expect(data.title).toBe("ℹ️ Heads up");
    expect(data.color).toBe(EmbedColors.Info);
  });
});

describe("CommonEmbedPresets.plain", () => {
  it("defaults to the Info color when no override is given", () => {
    const data = CommonEmbedPresets.plain({ title: "T" }).build().data;
    expect(data.color).toBe(EmbedColors.Info);
  });

  it("applies title, description, and color overrides", () => {
    const data = CommonEmbedPresets.plain({
      title: "T",
      description: "D",
      color: 0xabcdef,
    }).build().data;
    expect(data.title).toBe("T");
    expect(data.description).toBe("D");
    expect(data.color).toBe(0xabcdef);
  });

  it("omits title and description when not provided", () => {
    const data = CommonEmbedPresets.plain({}).build().data;
    expect(data.title).toBeUndefined();
    expect(data.description).toBeUndefined();
  });
});

describe("CommonEmbedPresets.loading", () => {
  it("uses the default 'Processing...' message and Info color", () => {
    const data = CommonEmbedPresets.loading().build().data;
    expect(data.title).toBe("⏳ Please wait");
    expect(data.description).toBe("Processing...");
    expect(data.color).toBe(EmbedColors.Info);
  });

  it("uses a custom message when provided", () => {
    const data = CommonEmbedPresets.loading("Doing the thing").build().data;
    expect(data.description).toBe("Doing the thing");
  });
});

describe("CommonEmbedPresets.channelDeletion", () => {
  it("uses the Error color with the documented copy", () => {
    const data = CommonEmbedPresets.channelDeletion().build().data;
    expect(data.title).toBe("🗑️ Channel Deletion");
    expect(data.description).toContain("deleted");
    expect(data.color).toBe(EmbedColors.Error);
  });
});
