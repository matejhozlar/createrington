import { useRef, type ReactNode } from "react";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { insertAtCursor } from "@/lib/insertAtCursor";
import { CharCount } from "@/features/admin/components/CharCount";
import { InsertMenu } from "@/features/admin/components/InsertMenu";
import { useMentionResolver } from "@/features/admin/hooks/use-mention-resolver";
import { DiscordMarkdown } from "./DiscordMarkdown";
import { MentionAutocomplete } from "./MentionAutocomplete";
import { DISCORD_COLORS } from "./colors";

interface DiscordTextareaProps {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  max?: number;
  description?: ReactNode;
}

export function DiscordTextarea({
  id,
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
  max = 2000,
  description,
}: DiscordTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const mentionResolver = useMentionResolver();

  return (
    <Field>
      {label && (
        <div className="flex items-center gap-1">
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          <InsertMenu
            onInsert={(mention) =>
              insertAtCursor(ref.current, value, mention, onChange)
            }
          />
        </div>
      )}
      <div className="relative">
        <Textarea
          ref={ref}
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          maxLength={max}
        />
        <MentionAutocomplete inputRef={ref} value={value} onChange={onChange} />
      </div>
      <div className="flex items-center justify-between gap-2">
        {description ? (
          <FieldDescription>{description}</FieldDescription>
        ) : (
          <span />
        )}
        <CharCount value={value} max={max} />
      </div>
      {value.trim() && (
        <div
          className="rounded-md p-3 text-sm"
          style={{
            backgroundColor: DISCORD_COLORS.background,
            color: DISCORD_COLORS.text,
          }}
        >
          <DiscordMarkdown text={value} mentionResolver={mentionResolver} />
        </div>
      )}
    </Field>
  );
}
