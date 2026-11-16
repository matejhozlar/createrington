import { cn } from "@/lib/utils";
import { parseMinecraftText } from "@/lib/minecraftText";

interface MinecraftTextProps {
  text: string;
  className?: string;
}

export function MinecraftText({ text, className }: MinecraftTextProps) {
  return (
    <div className={cn("font-mono whitespace-pre-wrap", className)}>
      {parseMinecraftText(text).map((line, lineIndex) => (
        <p key={lineIndex} className="min-h-[1.25em]">
          {line.map((segment, index) => (
            <span
              key={index}
              style={{
                color: segment.color ?? undefined,
                fontWeight: segment.bold ? 700 : undefined,
                fontStyle: segment.italic ? "italic" : undefined,
                textDecoration:
                  [
                    segment.underline ? "underline" : "",
                    segment.strikethrough ? "line-through" : "",
                  ]
                    .filter(Boolean)
                    .join(" ") || undefined,
                opacity: segment.obfuscated ? 0.6 : undefined,
              }}
            >
              {segment.text}
            </span>
          ))}
        </p>
      ))}
    </div>
  );
}
