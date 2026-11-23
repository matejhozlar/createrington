import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

const DECOY_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

function redactedPlaceholder(value: string): string {
  let state = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    state ^= value.charCodeAt(index);
    state = Math.imul(state, 0x01000193);
  }

  const nextChar = (): string => {
    state = Math.imul(state ^ (state >>> 13), 0x85ebca6b);
    state = Math.imul(state ^ (state >>> 16), 0xc2b2ae35);
    return DECOY_ALPHABET[Math.abs(state) % DECOY_ALPHABET.length] ?? "x";
  };

  return Array.from(value, (char) =>
    /[0-9a-zA-Z]/.test(char) ? nextChar() : char,
  ).join("");
}

export function Sensitive({
  value,
  label = "value",
  className,
}: {
  value: string | null | undefined;
  label?: string;
  className?: string;
}) {
  const [revealed, setRevealed] = useState(false);
  const trimmed = value?.trim() ?? "";
  const decoy = useMemo(
    () => (trimmed ? redactedPlaceholder(trimmed) : ""),
    [trimmed],
  );

  if (!trimmed) return null;

  return (
    <button
      type="button"
      aria-pressed={revealed}
      aria-label={revealed ? `Hide ${label}` : `Reveal ${label}`}
      title={revealed ? "Click to hide" : "Click to reveal"}
      onClick={() => setRevealed((current) => !current)}
      className={cn(
        "inline-flex min-w-0 max-w-full cursor-pointer items-center transition-colors hover:text-foreground motion-reduce:transition-none",
        className,
      )}
    >
      <span className="inline-grid min-w-0 max-w-full">
        <span
          aria-hidden
          className={cn(
            "col-start-1 row-start-1 select-none truncate blur-[2px]",
            revealed && "invisible",
          )}
        >
          {decoy}
        </span>
        <span
          className={cn(
            "col-start-1 row-start-1 truncate",
            revealed ? "select-text" : "select-none invisible",
          )}
        >
          {trimmed}
        </span>
      </span>
    </button>
  );
}
