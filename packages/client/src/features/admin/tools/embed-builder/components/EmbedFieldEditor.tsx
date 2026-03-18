import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRef } from "react";
import { MentionPicker } from "@/features/admin/components/MentionPicker";
import type { EmbedField } from "@createrington/shared/api/embed";

function CharCount({ value, max }: { value: string; max: number }) {
  const len = value.length;
  if (len === 0) return null;
  const warn = len > max * 0.9;
  const over = len > max;
  return (
    <span
      className={cn(
        "text-[11px] tabular-nums text-muted-foreground",
        warn && !over && "text-yellow-500",
        over && "text-destructive",
      )}
    >
      {len}/{max}
    </span>
  );
}

interface EmbedFieldInternal extends EmbedField {
  _id: string;
}

interface EmbedFieldEditorProps {
  fields: EmbedField[];
  onChange: (fields: EmbedField[]) => void;
}

function hasId(field: EmbedField): field is EmbedFieldInternal {
  return (
    "_id" in field && typeof (field as EmbedFieldInternal)._id === "string"
  );
}

export function EmbedFieldEditor({ fields, onChange }: EmbedFieldEditorProps) {
  const valueRefs = useRef<Map<number, HTMLTextAreaElement>>(new Map());

  function insertMentionAtCursor(index: number, mention: string) {
    const el = valueRefs.current.get(index);
    const value = fields[index]?.value ?? "";
    const pos = el?.selectionStart ?? value.length;
    const newValue = value.slice(0, pos) + mention + value.slice(pos);
    onChange(fields.map((f, i) => (i === index ? { ...f, value: newValue } : f)));

    requestAnimationFrame(() => {
      if (el) {
        const newPos = pos + mention.length;
        el.selectionStart = newPos;
        el.selectionEnd = newPos;
        el.focus();
      }
    });
  }

  function addField() {
    if (fields.length >= 25) return;
    onChange([
      ...fields,
      {
        name: "",
        value: "",
        inline: false,
        _id: crypto.randomUUID(),
      } as EmbedField,
    ]);
  }

  function removeField(index: number) {
    onChange(fields.filter((_, i) => i !== index));
  }

  function updateField(index: number, updates: Partial<EmbedField>) {
    onChange(fields.map((f, i) => (i === index ? { ...f, ...updates } : f)));
  }

  function moveField(index: number, direction: -1 | 1) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= fields.length) return;
    const updated = [...fields];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    onChange(updated);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Fields ({fields.length}/25)</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addField}
          disabled={fields.length >= 25}
          className="cursor-pointer"
        >
          <Plus className="mr-1 size-3.5" />
          Add Field
        </Button>
      </div>

      {fields.length === 0 && (
        <p className="text-xs text-muted-foreground">No fields added yet.</p>
      )}

      <div className="space-y-3">
        {fields.map((field, i) => {
          const key = hasId(field) ? field._id : i;
          return (
            <div
              key={key}
              className="space-y-2 rounded-md border border-border bg-sidebar/50 p-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Field {i + 1}
                </span>
                <div className="flex gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => moveField(i, -1)}
                        disabled={i === 0}
                        className="size-7 cursor-pointer p-0"
                      >
                        <ArrowUp className="size-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Move up</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => moveField(i, 1)}
                        disabled={i === fields.length - 1}
                        className="size-7 cursor-pointer p-0"
                      >
                        <ArrowDown className="size-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Move down</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeField(i)}
                        className="size-7 cursor-pointer p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Remove field</TooltipContent>
                  </Tooltip>
                </div>
              </div>

              <div className="space-y-1">
                <Input
                  placeholder="Field name"
                  value={field.name}
                  onChange={(e) => updateField(i, { name: e.target.value })}
                  maxLength={256}
                />
                <div className="flex justify-end">
                  <CharCount value={field.name} max={256} />
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">Value</span>
                  <MentionPicker
                    onInsert={(mention) => insertMentionAtCursor(i, mention)}
                  />
                </div>
                <textarea
                  ref={(el) => {
                    if (el) valueRefs.current.set(i, el);
                    else valueRefs.current.delete(i);
                  }}
                  placeholder="Field value"
                  value={field.value}
                  onChange={(e) => updateField(i, { value: e.target.value })}
                  rows={2}
                  maxLength={1024}
                  className="border-input bg-transparent placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
                />
                <div className="flex justify-end">
                  <CharCount value={field.value} max={1024} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`field-inline-${key}`}
                  checked={field.inline}
                  onCheckedChange={(checked) =>
                    updateField(i, { inline: checked === true })
                  }
                />
                <label
                  htmlFor={`field-inline-${key}`}
                  className="cursor-pointer text-xs text-muted-foreground"
                >
                  Inline
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
