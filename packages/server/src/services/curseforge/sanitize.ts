import sanitizeHtml from "sanitize-html";

const YOUTUBE_EMBED_RE =
  /^https?:\/\/(www\.)?(youtube\.com|youtube-nocookie\.com)\/embed\/([\w-]+)/;

// Author-controlled HTML: strict allowlist, no scripts, styles, or frames.
// YouTube iframes (common in mod descriptions) degrade to a plain link.
const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "br",
    "hr",
    "div",
    "span",
    "a",
    "img",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "sub",
    "sup",
    "ul",
    "ol",
    "li",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "blockquote",
    "pre",
    "code",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
  ],
  allowedAttributes: {
    a: ["href"],
    img: ["src", "alt", "width", "height"],
  },
  allowedSchemes: ["http", "https"],
  transformTags: {
    iframe: (
      _tagName,
      attribs,
    ): { tagName: string; attribs: Record<string, string>; text: string } => {
      const match = YOUTUBE_EMBED_RE.exec(attribs.src ?? "");
      if (match) {
        return {
          tagName: "a",
          attribs: { href: `https://www.youtube.com/watch?v=${match[3]}` },
          text: "Watch video",
        };
      }
      return { tagName: "span", attribs: {}, text: "" };
    },
  },
};

/** Sanitize a CurseForge project description for safe rendering in the client. */
export function sanitizeDescription(html: string): string {
  return sanitizeHtml(html, SANITIZE_OPTIONS);
}
