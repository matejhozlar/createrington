import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { processDiscordTimestamps } from "./utils";

export function ChatMarkdown({
  children,
  variant = "body",
}: {
  children: string;
  variant?: "body" | "embed-title" | "embed-body";
}) {
  const isTitle = variant === "embed-title";
  const isEmbed = variant === "embed-body";

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none break-words leading-relaxed select-text">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p
              className={cn(
                "my-0.5",
                isTitle
                  ? "text-sm font-semibold text-primary"
                  : isEmbed
                    ? "text-sm text-muted-foreground"
                    : "text-sm text-foreground",
              )}
            >
              {children}
            </p>
          ),
          a: ({ children, href }) => {
            const isChannelMention =
              href?.includes("discord.com/channels/") ?? false;

            if (isChannelMention) {
              return (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-[3px] bg-discord/15 px-0.5 text-discord-foreground hover:bg-discord/30 hover:text-white"
                >
                  {children}
                </a>
              );
            }

            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "hover:underline",
                  isTitle ? "text-primary font-semibold" : "text-primary",
                )}
              >
                {children}
              </a>
            );
          },
          code: ({
            inline,
            children,
          }: {
            inline?: boolean;
            children?: React.ReactNode;
          }) =>
            inline ? (
              <code
                className={cn(
                  "rounded font-mono",
                  isTitle
                    ? "bg-sidebar-accent px-1.5 py-0.5 text-xs text-primary font-semibold"
                    : isEmbed
                      ? "bg-sidebar-accent px-1.5 py-0.5 text-xs text-muted-foreground"
                      : "bg-sidebar-accent px-1.5 py-0.5 text-sm text-foreground",
                )}
              >
                {children}
              </code>
            ) : (
              <code
                className={cn(
                  "block font-mono",
                  isEmbed ? "text-xs" : "text-sm",
                )}
              >
                {children}
              </code>
            ),
          pre: ({ children }) => (
            <pre
              className={cn(
                "my-1.5 overflow-x-auto rounded-lg p-3",
                isEmbed
                  ? "bg-sidebar p-2 text-xs"
                  : "bg-sidebar-accent text-sm",
              )}
            >
              {children}
            </pre>
          ),
          ul: ({ children }) => (
            <ul
              className={cn(
                "my-0.5 list-disc pl-4",
                isEmbed
                  ? "text-xs text-muted-foreground"
                  : "text-sm text-foreground",
              )}
            >
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol
              className={cn(
                "my-0.5 list-decimal pl-4",
                isEmbed
                  ? "text-xs text-muted-foreground"
                  : "text-sm text-foreground",
              )}
            >
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li
              className={isEmbed ? "text-muted-foreground" : "text-foreground"}
            >
              {children}
            </li>
          ),
          blockquote: ({ children }) => (
            <blockquote
              className={cn(
                "my-1.5 border-l-2 border-primary pl-3 italic",
                isEmbed
                  ? "border-primary/50 pl-2 text-xs text-muted-foreground/80"
                  : "text-muted-foreground",
              )}
            >
              {children}
            </blockquote>
          ),
          h1: ({ children }) => (
            <h1
              className={cn(
                "my-1.5 font-bold",
                isEmbed
                  ? "text-sm text-muted-foreground"
                  : "text-lg text-foreground",
              )}
            >
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2
              className={cn(
                "my-1.5 font-bold",
                isEmbed
                  ? "text-sm text-muted-foreground"
                  : "text-base text-foreground",
              )}
            >
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3
              className={cn(
                "my-1 font-bold",
                isEmbed
                  ? "text-xs text-muted-foreground"
                  : "text-sm text-foreground",
              )}
            >
              {children}
            </h3>
          ),
          strong: ({ children }) => (
            <strong
              className={cn(
                "font-semibold",
                isTitle
                  ? "text-primary"
                  : isEmbed
                    ? "text-muted-foreground"
                    : "text-foreground",
              )}
            >
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em
              className={cn(
                "italic",
                isTitle
                  ? "text-primary font-semibold"
                  : isEmbed
                    ? "text-muted-foreground"
                    : "text-foreground",
              )}
            >
              {children}
            </em>
          ),
        }}
      >
        {processDiscordTimestamps(children)}
      </ReactMarkdown>
    </div>
  );
}
