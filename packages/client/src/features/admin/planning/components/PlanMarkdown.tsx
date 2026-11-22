import ReactMarkdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

const REMARK_PLUGINS = [remarkGfm, remarkBreaks];

const COMPONENTS: Components = {
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline"
    >
      {children}
    </a>
  ),
  code: ({ className, children }) => (
    <code
      className={cn(
        "rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]",
        className,
      )}
    >
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="my-3 overflow-x-auto rounded-md bg-muted p-3 font-mono text-sm [&>code]:bg-transparent [&>code]:p-0">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-border bg-muted px-2 py-1 text-left font-semibold">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-border px-2 py-1 text-left">{children}</td>
  ),
};

const PROSE =
  "min-w-0 break-words text-sm leading-relaxed [&>:first-child]:mt-0 [&>:last-child]:mb-0 [&_p]:my-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_li>p]:my-0 [&_li>ul]:my-1 [&_li>ol]:my-1 [&_h1]:mt-6 [&_h1]:mb-3 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mt-6 [&_h2]:mb-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-5 [&_h3]:mb-2 [&_h3]:text-base [&_h3]:font-semibold [&_h4]:mt-4 [&_h4]:mb-2 [&_h4]:font-semibold [&_hr]:my-4 [&_hr]:border-0 [&_hr]:border-t [&_hr]:border-border [&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_img]:max-w-full [&_ul.contains-task-list]:list-none [&_ul.contains-task-list]:pl-1 [&_input[type=checkbox]]:mr-2";

interface PlanMarkdownProps {
  text: string;
  className?: string;
}

export function PlanMarkdown({ text, className }: PlanMarkdownProps) {
  return (
    <div className={cn(PROSE, className)}>
      <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={COMPONENTS}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
