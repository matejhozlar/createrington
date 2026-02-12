import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import type { EmbedField } from "@createrington/shared/api/embed";

interface EmbedFieldEditorProps {
  fields: EmbedField[];
  onChange: (fields: EmbedField[]) => void;
}

export function EmbedFieldEditor({ fields, onChange }: EmbedFieldEditorProps) {
  function addField() {
    if (fields.length >= 25) return;
    onChange([...fields, { name: "", value: "", inline: false }]);
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
        <p className="text-xs text-muted-foreground">
          No fields added yet.
        </p>
      )}

      <div className="space-y-3">
        {fields.map((field, i) => (
          <div
            key={i}
            className="space-y-2 rounded-md border border-border bg-sidebar/50 p-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Field {i + 1}
              </span>
              <div className="flex gap-1">
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
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeField(i)}
                  className="size-7 cursor-pointer p-0 text-destructive hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>

            <Input
              placeholder="Field name"
              value={field.name}
              onChange={(e) => updateField(i, { name: e.target.value })}
            />
            <textarea
              placeholder="Field value"
              value={field.value}
              onChange={(e) => updateField(i, { value: e.target.value })}
              rows={2}
              className="border-input bg-transparent placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
            />
            <div className="flex items-center gap-2">
              <Checkbox
                id={`field-inline-${i}`}
                checked={field.inline}
                onCheckedChange={(checked) =>
                  updateField(i, { inline: checked === true })
                }
              />
              <label
                htmlFor={`field-inline-${i}`}
                className="cursor-pointer text-xs text-muted-foreground"
              >
                Inline
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
