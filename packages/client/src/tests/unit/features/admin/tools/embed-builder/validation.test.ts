import { describe, expect, it } from "vitest";
import type { ComponentNode } from "@createrington/shared/api/embed";
import { findPayloadIssue } from "@/features/admin/tools/embed-builder/validation";
import { DEFAULT_EMBED } from "@/features/admin/tools/embed-builder/payload";

const embedIssue = (fields: { name: string; value: string }[]) =>
  findPayloadIssue({
    kind: "embed",
    embed: {
      ...DEFAULT_EMBED,
      fields: fields.map((f) => ({ ...f, inline: false })),
    },
  });

const treeIssue = (components: ComponentNode[]) =>
  findPayloadIssue({ kind: "components", components: { components } });

const text = (content: string): ComponentNode => ({ type: "text", content });

const button = (label: string, url: string) =>
  ({ type: "button", label, url }) as const;

describe("findPayloadIssue for an embed", () => {
  it("accepts fields that all have a name and a value", () => {
    expect(embedIssue([{ name: "Rule", value: "Be kind" }])).toBeNull();
  });

  it("accepts an embed without fields", () => {
    expect(embedIssue([])).toBeNull();
  });

  it("names the one field that is missing its name or value", () => {
    expect(
      embedIssue([
        { name: "Rule", value: "Be kind" },
        { name: "Second", value: "   " },
      ]),
    ).toBe("Field #2 is empty. Fill in both name and value, or remove it.");
  });

  it("lists every incomplete field", () => {
    expect(
      embedIssue([
        { name: "", value: "x" },
        { name: "ok", value: "ok" },
        { name: "x", value: "" },
      ]),
    ).toBe(
      "Fields #1, #3 are empty. Fill in both name and value, or remove them.",
    );
  });
});

describe("findPayloadIssue for components", () => {
  it("accepts a complete tree", () => {
    const tree: ComponentNode[] = [
      text("Welcome"),
      { type: "separator", divider: true, spacing: 1 },
      {
        type: "action_row",
        components: [button("Website", "https://createrington.com")],
      },
    ];

    expect(treeIssue(tree)).toBeNull();
  });

  it("counts nested components against Discord's limit of 40", () => {
    const container = (children: number): ComponentNode => ({
      type: "container",
      spoiler: false,
      components: Array.from({ length: children }, () => ({
        type: "text" as const,
        content: "Hi",
      })),
    });

    expect(treeIssue([container(39)])).toBeNull();
    expect(treeIssue([container(40)])).toBe(
      "The message has 41 components. Discord allows at most 40, counting nested ones.",
    );
  });

  it("reports text longer than Discord allows in one message", () => {
    expect(treeIssue([text("a".repeat(2001)), text("b".repeat(2000))])).toBe(
      "The message has 4001 characters of text. Discord allows at most 4000.",
    );
  });

  it("reports an empty text component", () => {
    expect(treeIssue([text("  ")])).toBe("A text component is empty.");
  });

  it("reports a gallery image without a URL", () => {
    expect(
      treeIssue([
        { type: "media_gallery", items: [{ url: "", spoiler: false }] },
      ]),
    ).toBe("A media gallery image is missing a URL.");
  });

  it("reports a button without a label, then without a URL", () => {
    expect(
      treeIssue([
        { type: "action_row", components: [button("", "https://x.test")] },
      ]),
    ).toBe("A button is missing a label.");
    expect(
      treeIssue([{ type: "action_row", components: [button("Open", " ")] }]),
    ).toBe("A button is missing a URL.");
  });

  it("checks the texts and the accessory of a section", () => {
    const section = (
      content: string,
      accessory: Extract<ComponentNode, { type: "section" }>["accessory"],
    ): ComponentNode => ({
      type: "section",
      components: [{ type: "text", content }],
      accessory,
    });

    expect(treeIssue([section("", button("Open", "https://x.test"))])).toBe(
      "A section text is empty.",
    );
    expect(
      treeIssue([
        section("Hi", { type: "thumbnail", url: "", spoiler: false }),
      ]),
    ).toBe("A section thumbnail is missing an image URL.");
    expect(treeIssue([section("Hi", button("Open", ""))])).toBe(
      "A button is missing a URL.",
    );
  });

  it("looks inside a container", () => {
    expect(
      treeIssue([
        {
          type: "container",
          spoiler: false,
          components: [{ type: "text", content: "" }],
        },
      ]),
    ).toBe("A text component is empty.");
  });

  it("rejects an image that points at a message attachment", () => {
    expect(
      treeIssue([
        {
          type: "media_gallery",
          items: [{ url: "attachment://banner.png", spoiler: false }],
        },
      ]),
    ).toBe(
      "attachment://banner.png points at a message attachment, which the builder cannot send.",
    );
  });
});
