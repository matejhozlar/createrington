import { describe, it, expect } from "vitest";
import { sanitizeDescription } from "@/services/curseforge/sanitize";

describe("sanitizeDescription", () => {
  it("keeps basic formatting markup", () => {
    const html = "<p>Hello <strong>world</strong></p><ul><li>item</li></ul>";
    expect(sanitizeDescription(html)).toBe(html);
  });

  it("strips script tags entirely", () => {
    expect(sanitizeDescription('<p>ok</p><script>alert("xss")</script>')).toBe(
      "<p>ok</p>",
    );
  });

  it("strips event handler attributes", () => {
    expect(sanitizeDescription('<p onclick="alert(1)">ok</p>')).toBe(
      "<p>ok</p>",
    );
  });

  it("strips style attributes and tags", () => {
    expect(
      sanitizeDescription(
        '<style>p{color:red}</style><p style="color:red">ok</p>',
      ),
    ).toBe("<p>ok</p>");
  });

  it("drops javascript: links but keeps https links", () => {
    expect(sanitizeDescription('<a href="javascript:alert(1)">x</a>')).toBe(
      "<a>x</a>",
    );
    expect(sanitizeDescription('<a href="https://example.com">x</a>')).toBe(
      '<a href="https://example.com">x</a>',
    );
  });

  it("keeps images with safe attributes only", () => {
    expect(
      sanitizeDescription(
        '<img src="https://media.forgecdn.net/a.png" alt="logo" onerror="x()">',
      ),
    ).toBe('<img src="https://media.forgecdn.net/a.png" alt="logo" />');
  });

  it("converts YouTube iframes to watch links", () => {
    const html =
      '<iframe src="https://www.youtube.com/embed/rR8W-f9YhYA?wmode=transparent"></iframe>';
    expect(sanitizeDescription(html)).toBe(
      '<a href="https://www.youtube.com/watch?v=rR8W-f9YhYA">Watch video</a>',
    );
  });

  it("drops non-YouTube iframes", () => {
    expect(
      sanitizeDescription('<iframe src="https://evil.example/embed"></iframe>'),
    ).toBe("<span></span>");
  });
});
