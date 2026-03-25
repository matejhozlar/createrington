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
 *   ||spoiler||          — spoiler (revealed text)
 *   # / ## / ### heading — heading (Discord supports up to h3 in embeds)
 *   - item / * item     — unordered list
 *   1. item              — ordered list
 *     - sub item         — nested list (indent 2+ spaces)
 */

// ── Inline parsing ──────────────────────────────────────────────────────

export interface MentionResolver {
  channels: Map<string, string>;
  roles: Map<string, string>;
}

type InlineToken =
  | { type: "text"; content: string }
  | { type: "bold_italic"; content: string }
  | { type: "bold"; content: string }
  | { type: "underline"; content: string }
  | { type: "italic"; content: string }
  | { type: "strikethrough"; content: string }
  | { type: "spoiler"; content: string }
  | { type: "code"; content: string }
  | { type: "link"; text: string; url: string }
  | { type: "channel_mention"; id: string }
  | { type: "role_mention"; id: string }
  | { type: "timestamp"; unix: number; format: string };

const INLINE_RULES: Array<{
  pattern: RegExp;
  parse: (match: RegExpMatchArray) => InlineToken;
}> = [
  // Order matters — more specific patterns first
  // Discord timestamps: <t:UNIX:FORMAT> or <t:UNIX>
  {
    pattern: /^<t:(\d+)(?::([tTdDfFR]))?>/,
    parse: (m) => ({ type: "timestamp", unix: Number(m[1]), format: m[2] ?? "f" }),
  },
  // Discord mentions: <#channelId>, <@&roleId>
  {
    pattern: /^<#(\d+)>/,
    parse: (m) => ({ type: "channel_mention", id: m[1] }),
  },
  {
    pattern: /^<@&(\d+)>/,
    parse: (m) => ({ type: "role_mention", id: m[1] }),
  },
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
  {
    pattern: /^\|\|(.+?)\|\|/s,
    parse: (m) => ({ type: "spoiler", content: m[1] }),
  },
];

function formatDiscordTimestamp(date: Date, format: string): string {
  switch (format) {
    case "t":
      return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    case "T":
      return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
    case "d":
      return date.toLocaleDateString();
    case "D":
      return date.toLocaleDateString([], { year: "numeric", month: "long", day: "numeric" });
    case "f":
      return date.toLocaleDateString([], { year: "numeric", month: "long", day: "numeric" }) +
        " " + date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    case "F":
      return date.toLocaleDateString([], { weekday: "long", year: "numeric", month: "long", day: "numeric" }) +
        " " + date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    case "R": {
      const now = Date.now();
      const diff = date.getTime() - now;
      const absDiff = Math.abs(diff);
      const seconds = Math.floor(absDiff / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);
      const isFuture = diff > 0;

      let relative: string;
      if (days > 0) relative = `${days} day${days !== 1 ? "s" : ""}`;
      else if (hours > 0) relative = `${hours} hour${hours !== 1 ? "s" : ""}`;
      else if (minutes > 0) relative = `${minutes} minute${minutes !== 1 ? "s" : ""}`;
      else relative = `${seconds} second${seconds !== 1 ? "s" : ""}`;

      return isFuture ? `in ${relative}` : `${relative} ago`;
    }
    default:
      return date.toLocaleString();
  }
}

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

function renderInline(text: string, resolver?: MentionResolver): ReactNode[] {
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
            <em>{renderInline(token.content, resolver)}</em>
          </strong>
        );
      case "bold":
        return <strong key={i}>{renderInline(token.content, resolver)}</strong>;
      case "underline":
        return <u key={i}>{renderInline(token.content, resolver)}</u>;
      case "italic":
        return <em key={i}>{renderInline(token.content, resolver)}</em>;
      case "strikethrough":
        return <s key={i}>{renderInline(token.content, resolver)}</s>;
      case "spoiler":
        return (
          <span
            key={i}
            className="cursor-pointer rounded px-0.5"
            style={{ backgroundColor: "#1E1F22" }}
          >
            {renderInline(token.content, resolver)}
          </span>
        );
      case "timestamp": {
        const date = new Date(token.unix * 1000);
        const formatted = formatDiscordTimestamp(date, token.format);
        return (
          <span
            key={i}
            className="rounded px-0.5 font-medium"
            style={{
              backgroundColor: "rgba(88, 101, 242, 0.3)",
              color: "#C9CDFB",
            }}
          >
            {formatted}
          </span>
        );
      }
      case "channel_mention": {
        const name = resolver?.channels.get(token.id);
        return (
          <span
            key={i}
            className="rounded px-0.5 font-medium"
            style={{
              backgroundColor: "rgba(88, 101, 242, 0.3)",
              color: "#C9CDFB",
            }}
          >
            #{name ?? token.id}
          </span>
        );
      }
      case "role_mention": {
        const name = resolver?.roles.get(token.id);
        return (
          <span
            key={i}
            className="rounded px-0.5 font-medium"
            style={{
              backgroundColor: "rgba(88, 101, 242, 0.3)",
              color: "#C9CDFB",
            }}
          >
            @{name ?? token.id}
          </span>
        );
      }
    }
  });
}

// ── Block parsing ───────────────────────────────────────────────────────

interface DiscordMarkdownProps {
  text: string;
  mentionResolver?: MentionResolver;
}

export function DiscordMarkdown({
  text,
  mentionResolver,
}: DiscordMarkdownProps) {
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
      const sizes = [
        "text-xl font-bold",
        "text-lg font-bold",
        "text-base font-semibold",
      ];
      blocks.push(
        <div
          key={blocks.length}
          className={`${sizes[level - 1]} mt-1 text-white`}
        >
          {renderInline(content, mentionResolver)}
        </div>,
      );
      i++;
      continue;
    }

    // Blockquote: > text (collect consecutive > lines)
    if (line.startsWith("> ") || line === ">") {
      const quoteLines: string[] = [];
      while (
        i < lines.length &&
        (lines[i].startsWith("> ") || lines[i] === ">")
      ) {
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
            <div key={qi}>
              {ql ? renderInline(ql, mentionResolver) : <br />}
            </div>
          ))}
        </div>,
      );
      continue;
    }

    // Unordered list: - item or * item (collect consecutive lines, with optional nested sub-items)
    if (/^[-*]\s+/.test(line)) {
      const items: { text: string; subItems: string[] }[] = [];
      while (i < lines.length) {
        if (/^[-*]\s+/.test(lines[i])) {
          items.push({
            text: lines[i].replace(/^[-*]\s+/, ""),
            subItems: [],
          });
          i++;
          while (i < lines.length && /^\s{2,}[-*]\s+/.test(lines[i])) {
            items[items.length - 1].subItems.push(
              lines[i].replace(/^\s{2,}[-*]\s+/, ""),
            );
            i++;
          }
        } else {
          break;
        }
      }
      blocks.push(
        <ul key={blocks.length} className="my-0.5 list-disc pl-6">
          {items.map((item, j) => (
            <li key={j}>
              {renderInline(item.text, mentionResolver)}
              {item.subItems.length > 0 && (
                <ul className="my-0.5 list-disc pl-6">
                  {item.subItems.map((sub, k) => (
                    <li key={k}>{renderInline(sub, mentionResolver)}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    // Ordered list: 1. item, 2. item, etc. (with optional nested sub-items)
    if (/^\d+\.\s+/.test(line)) {
      const items: { text: string; subItems: string[] }[] = [];
      while (i < lines.length) {
        if (/^\d+\.\s+/.test(lines[i])) {
          items.push({
            text: lines[i].replace(/^\d+\.\s+/, ""),
            subItems: [],
          });
          i++;
          while (i < lines.length && /^\s{2,}[-*]\s+/.test(lines[i])) {
            items[items.length - 1].subItems.push(
              lines[i].replace(/^\s{2,}[-*]\s+/, ""),
            );
            i++;
          }
        } else {
          break;
        }
      }
      blocks.push(
        <ol key={blocks.length} className="my-0.5 list-decimal pl-6">
          {items.map((item, j) => (
            <li key={j}>
              {renderInline(item.text, mentionResolver)}
              {item.subItems.length > 0 && (
                <ul className="my-0.5 list-disc pl-6">
                  {item.subItems.map((sub, k) => (
                    <li key={k}>{renderInline(sub, mentionResolver)}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>,
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
    blocks.push(
      <div key={blocks.length}>{renderInline(line, mentionResolver)}</div>,
    );
    i++;
  }

  return <>{blocks}</>;
}
