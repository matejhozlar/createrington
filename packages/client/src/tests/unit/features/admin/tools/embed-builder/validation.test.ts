import { describe, expect, it } from "vitest";
import type { ComponentNode } from "@createrington/shared/api/embed";
import { findPayloadIssue } from "@/features/admin/tools/embed-builder/validation";

const text = (content: string): ComponentNode => ({ type: "text", content });

const button = (label: string, url: string) =>
  ({ type: "button", label, url }) as const;

describe("findPayloadIssue for an embed", () => {
  it("accepts fields that all have a name and a value", () => {
    expect(
      findPayloadIssue("embed", [{ name: "Rule", value: "Be kind" }], []),
    ).toBeNull();
  });

  it("accepts an embed without fields", () => {
    expect(findPayloadIssue("embed", [], [])).toBeNull();
  });

  it("names the one field that is missing its name or value", () => {
    expect(
      findPayloadIssue(
        "embed",
        [
          { name: "Rule", value: "Be kind" },
          { name: "Second", value: "   " },
        ],
        [],
      ),
    ).toBe("Field #2 is empty. Fill in both name and value, or remove it.");
  });

  it("lists every incomplete field", () => {
    expect(
      findPayloadIssue(
        "embed",
        [
          { name: "", value: "x" },
          { name: "ok", value: "ok" },
          { name: "x", value: "" },
        ],
        [],
      ),
    ).toBe(
      "Fields #1, #3 are empty. Fill in both name and value, or remove them.",
    );
  });

  it("ignores the component tree", () => {
    expect(findPayloadIssue("embed", [], [text("")])).toBeNull();
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

    expect(findPayloadIssue("components", [], tree)).toBeNull();
  });

  it("ignores the embed fields", () => {
    expect(
      findPayloadIssue("components", [{ name: "", value: "" }], [text("Hi")]),
    ).toBeNull();
  });

  it("reports an empty text component", () => {
    expect(findPayloadIssue("components", [], [text("  ")])).toBe(
      "A text component is empty.",
    );
  });

  it("reports a gallery image without a URL", () => {
    expect(
      findPayloadIssue(
        "components",
        [],
        [{ type: "media_gallery", items: [{ url: "", spoiler: false }] }],
      ),
    ).toBe("A media gallery image is missing a URL.");
  });

  it("reports a button without a label, then without a URL", () => {
    expect(
      findPayloadIssue(
        "components",
        [],
        [{ type: "action_row", components: [button("", "https://x.test")] }],
      ),
    ).toBe("A button is missing a label.");
    expect(
      findPayloadIssue(
        "components",
        [],
        [{ type: "action_row", components: [button("Open", " ")] }],
      ),
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

    expect(
      findPayloadIssue(
        "components",
        [],
        [section("", button("Open", "https://x.test"))],
      ),
    ).toBe("A section text is empty.");
    expect(
      findPayloadIssue(
        "components",
        [],
        [section("Hi", { type: "thumbnail", url: "", spoiler: false })],
      ),
    ).toBe("A section thumbnail is missing an image URL.");
    expect(
      findPayloadIssue("components", [], [section("Hi", button("Open", ""))]),
    ).toBe("A button is missing a URL.");
  });

  it("looks inside a container", () => {
    expect(
      findPayloadIssue(
        "components",
        [],
        [
          {
            type: "container",
            spoiler: false,
            components: [{ type: "text", content: "" }],
          },
        ],
      ),
    ).toBe("A text component is empty.");
  });

  it("rejects an image that points at a message attachment", () => {
    expect(
      findPayloadIssue(
        "components",
        [],
        [
          {
            type: "media_gallery",
            items: [{ url: "attachment://banner.png", spoiler: false }],
          },
        ],
      ),
    ).toBe(
      "attachment://banner.png points at a message attachment, which the builder cannot send.",
    );
  });
});
