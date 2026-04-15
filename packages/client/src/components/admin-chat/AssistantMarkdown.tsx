import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";

interface AssistantMarkdownProps {
  text: string;
  navigate: (to: string) => void;
}

export function AssistantMarkdown({
  text,
  navigate,
}: AssistantMarkdownProps): React.JSX.Element {
  return (
    <div className="prose-sm prose-invert max-w-none [&_:first-child]:mt-0 [&_:last-child]:mb-0 [&_p]:m-0 [&_p:not(:last-child)]:mb-1.5 [&_ul]:mb-1.5 [&_ul]:pl-5 [&_ol]:mb-1.5 [&_ol]:pl-5 [&_li]:my-0.5 [&_li>p]:m-0 [&_h1]:mt-2 [&_h1]:mb-1 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:mt-2 [&_h2]:mb-1 [&_h2]:text-[0.9375rem] [&_h2]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold [&_h4]:mt-2 [&_h4]:mb-1 [&_h4]:font-semibold [&_hr]:my-2 [&_hr]:border-0 [&_hr]:border-t [&_hr]:border-border [&_blockquote]:my-1 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:px-2.5 [&_blockquote]:py-1 [&_blockquote]:text-muted-foreground">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          a: ({ href, children }) => {
            if (typeof href === "string" && /^https?:\/\//i.test(href)) {
              return (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  {children}
                </a>
              );
            }
            if (typeof href === "string" && href.startsWith("/")) {
              return (
                <a
                  href={href}
                  className="text-primary underline"
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
                    e.preventDefault();
                    navigate(href);
                  }}
                >
                  {children}
                </a>
              );
            }
            return <>{children}</>;
          },
          code: ({
            inline,
            className,
            children,
          }: {
            inline?: boolean;
            className?: string;
            children?: React.ReactNode;
          }) =>
            inline ? (
              <code className="rounded bg-background px-1 py-0.5 font-mono text-xs">
                {children}
              </code>
            ) : (
              <code className={className}>{children}</code>
            ),
          pre: ({ children }) => (
            <pre className="my-1 overflow-x-auto whitespace-pre rounded-md bg-background p-2 font-mono text-xs">
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div className="my-1.5 overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-border bg-background px-2 py-1 text-left font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-border px-2 py-1 text-left">
              {children}
            </td>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
