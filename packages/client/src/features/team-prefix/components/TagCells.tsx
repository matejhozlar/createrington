import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { TAG_LENGTH } from "@createrington/shared/team-prefix";
import { cn } from "@/lib/utils";
import { sanitizeTag } from "../hooks/use-plate-draft";

const CELLS = Array.from({ length: TAG_LENGTH }, (_, i) => i);

export function TagCells({
  tag,
  onChange,
}: {
  tag: string;
  onChange: (tag: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pending = useRef<{ caret: number; overwrite: boolean } | null>(null);
  const [cursor, setCursor] = useState<number | null>(null);
  const [edits, setEdits] = useState(0);

  const placeCaret = useCallback((caret: number, overwrite: boolean) => {
    const input = inputRef.current;
    if (!input) return;
    const length = input.value.length;
    if (caret >= TAG_LENGTH) {
      input.setSelectionRange(TAG_LENGTH - 1, TAG_LENGTH);
    } else if (overwrite && caret < length) {
      input.setSelectionRange(caret, caret + 1);
    } else {
      input.setSelectionRange(Math.min(caret, length), Math.min(caret, length));
    }
    setCursor(Math.min(caret, length, TAG_LENGTH - 1));
  }, []);

  useLayoutEffect(() => {
    if (!pending.current) return;
    const { caret, overwrite } = pending.current;
    pending.current = null;
    if (overwrite && caret >= TAG_LENGTH) {
      inputRef.current?.blur();
      return;
    }
    placeCaret(caret, overwrite);
  }, [edits, placeCaret]);

  const change = (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const caret = sanitizeTag(
      input.value.slice(0, input.selectionStart ?? input.value.length),
    ).length;
    const inserted = (event.nativeEvent as InputEvent).inputType?.startsWith(
      "insert",
    );
    pending.current = { caret, overwrite: Boolean(inserted) };
    onChange(sanitizeTag(input.value));
    setEdits((count) => count + 1);
  };

  const paste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = sanitizeTag(event.clipboardData.getData("text"));
    if (pasted.length < TAG_LENGTH) return;
    event.preventDefault();
    pending.current = { caret: TAG_LENGTH, overwrite: true };
    onChange(pasted);
    setEdits((count) => count + 1);
  };

  const pickCell = (event: React.MouseEvent<HTMLInputElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const cell = Math.floor(
      ((event.clientX - rect.left) / rect.width) * TAG_LENGTH,
    );
    placeCaret(Math.max(0, Math.min(cell, TAG_LENGTH - 1)), true);
  };

  return (
    <label className="relative grid cursor-text grid-cols-4 gap-2">
      {CELLS.map((i) => {
        const char = tag[i];
        return (
          <span
            key={i}
            aria-hidden
            className={cn(
              "flex h-16 items-center justify-center rounded-xl border font-[Minecraft] text-[28px] text-foreground transition-[border-color,box-shadow] duration-150",
              char
                ? "border-(--border-strong) bg-card"
                : "border-input bg-white/3",
              i === cursor &&
                "border-primary shadow-[0_0_0_3px_var(--primary-glow)]",
            )}
          >
            {char}
          </span>
        );
      })}
      <input
        ref={inputRef}
        value={tag}
        onChange={change}
        onPaste={paste}
        onFocus={() => placeCaret(tag.length, true)}
        onClick={pickCell}
        onKeyUp={(event) =>
          setCursor(
            Math.min(event.currentTarget.selectionStart ?? 0, TAG_LENGTH - 1),
          )
        }
        onBlur={() => setCursor(null)}
        maxLength={TAG_LENGTH}
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        aria-label={`Tag, ${TAG_LENGTH} letters or digits`}
        aria-invalid={tag.length < TAG_LENGTH}
        className="absolute inset-0 size-full cursor-text text-base opacity-0"
      />
    </label>
  );
}
