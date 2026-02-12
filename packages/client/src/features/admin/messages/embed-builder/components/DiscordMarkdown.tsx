import type { ReactNode } from "react";

/**
 * Parses Discord-flavored markdown into React elements.
 *
 * Supported syntax (same subset Discord renders in embeds):
 *   ```lang\ncode\n```   — code block
 *   `code`               — inline code
 *   > line               — blockquote
 *   [text](url)          — link
 *   ***bold italic***    — bold + italic
 *   **bold**             — bold
 *   __underline__        — underline
 *   *italic* / _italic_  — italic
 *   ~~strikethrough~~    — strikethrough
 *   # / ## / ### heading — heading (Discord supports up to h3 in embeds)
 */

// ── Inline parsing ──────────────────────────────────────────────────────

type InlineToken =
  | { type: "text"; content: string }
  | { type: "bold_italic"; content: string }
  | { type: "bold"; content: string }
  | { type: "underline"; content: string }
  | { type: "italic"; content: string }
  | { type: "strikethrough"; content: string }
  | { type: "code"; content: string }
  | { type: "link"; text: string; url: string };

const INLINE_RULES: Array<{
  pattern: RegExp;
  parse: (match: RegExpMatchArray) => InlineToken;
}> = [
  // Order matters — more specific patterns first
  {
    pattern: /^`([^`]+?)`/,
    parse: (m) => ({ type: "code", content: m[1] }),
  },
  {
    pattern: /^\[([^\]]+?)\]\((https?:\/\/[^)]+?)\)/,
    parse: (m) => ({ type: "link", text: m[1], url: m[2] }),
  },
  {
    pattern: /^\*\*\*(.+?)\*\*\*/s,
    parse: (m) => ({ type: "bold_italic", content: m[1] }),
  },
  {
    pattern: /^\*\*(.+?)\*\*/s,
    parse: (m) => ({ type: "bold", content: m[1] }),
  },
  {
    pattern: /^__(.+?)__/s,
    parse: (m) => ({ type: "underline", content: m[1] }),
  },
  {
    pattern: /^\*(.+?)\*/s,
    parse: (m) => ({ type: "italic", content: m[1] }),
  },
  {
    pattern: /^_(.+?)_/s,
    parse: (m) => ({ type: "italic", content: m[1] }),
  },
  {
    pattern: /^~~(.+?)~~/s,
    parse: (m) => ({ type: "strikethrough", content: m[1] }),
  },
];

function tokeniseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    let matched = false;

    for (const rule of INLINE_RULES) {
      const match = remaining.match(rule.pattern);
      if (match) {
        tokens.push(rule.parse(match));
        remaining = remaining.slice(match[0].length);
        matched = true;
        break;
      }
    }

    if (!matched) {
      // Consume one character as plain text
      const last = tokens[tokens.length - 1];
      if (last?.type === "text") {
        last.content += remaining[0];
      } else {
        tokens.push({ type: "text", content: remaining[0] });
      }
      remaining = remaining.slice(1);
    }
  }

  return tokens;
}

function renderInline(text: string): ReactNode[] {
  return tokeniseInline(text).map((token, i) => {
    switch (token.type) {
      case "text":
        return <span key={i}>{token.content}</span>;
      case "code":
        return (
          <code
            key={i}
            className="rounded px-1 py-0.5 text-[0.85em]"
            style={{ backgroundColor: "#1E1F22" }}
          >
            {token.content}
          </code>
        );
      case "link":
        return (
          <a
            key={i}
            href={token.url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
            style={{ color: "#00AFF4" }}
          >
            {token.text}
          </a>
        );
      case "bold_italic":
        return (
          <strong key={i}>
            <em>{renderInline(token.content)}</em>
          </strong>
        );
      case "bold":
        return <strong key={i}>{renderInline(token.content)}</strong>;
      case "underline":
        return <u key={i}>{renderInline(token.content)}</u>;
      case "italic":
        return <em key={i}>{renderInline(token.content)}</em>;
      case "strikethrough":
        return <s key={i}>{renderInline(token.content)}</s>;
    }
  });
}

// ── Block parsing ───────────────────────────────────────────────────────

interface DiscordMarkdownProps {
  text: string;
}

export function DiscordMarkdown({ text }: DiscordMarkdownProps) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block: ```lang\n...\n```
    if (line.startsWith("```")) {
      const codeLines: string[] = [];
      i++; // skip opening ```
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      blocks.push(
        <pre
          key={blocks.length}
          className="my-1 overflow-x-auto rounded p-2 text-[0.85em]"
          style={{ backgroundColor: "#1E1F22" }}
        >
          <code>{codeLines.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    // Heading: # / ## / ###
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const content = headingMatch[2];
      const sizes = ["text-xl font-bold", "text-lg font-bold", "text-base font-semibold"];
      blocks.push(
        <div key={blocks.length} className={`${sizes[level - 1]} mt-1 text-white`}>
          {renderInline(content)}
        </div>,
      );
      i++;
      continue;
    }

    // Blockquote: > text (collect consecutive > lines)
    if (line.startsWith("> ") || line === ">") {
      const quoteLines: string[] = [];
      while (i < lines.length && (lines[i].startsWith("> ") || lines[i] === ">")) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      blocks.push(
        <div
          key={blocks.length}
          className="my-0.5 py-0.5 pl-3"
          style={{ borderLeft: "3px solid #4E5058" }}
        >
          {quoteLines.map((ql, qi) => (
            <div key={qi}>{ql ? renderInline(ql) : <br />}</div>
          ))}
        </div>,
      );
      continue;
    }

    // Empty line → small spacer
    if (line.trim() === "") {
      blocks.push(<div key={blocks.length} className="h-1" />);
      i++;
      continue;
    }

    // Normal line with inline markdown
    blocks.push(<div key={blocks.length}>{renderInline(line)}</div>);
    i++;
  }

  return <>{blocks}</>;
}
