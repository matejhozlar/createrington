import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import type { EmbedLinkButton } from "@createrington/shared/api/embed";

interface ButtonEditorProps {
  buttons: EmbedLinkButton[];
  onChange: (buttons: EmbedLinkButton[]) => void;
}

export function ButtonEditor({ buttons, onChange }: ButtonEditorProps) {
  function addButton() {
    if (buttons.length >= 5) return;
    onChange([...buttons, { label: "", url: "" }]);
  }

  function removeButton(index: number) {
    onChange(buttons.filter((_, i) => i !== index));
  }

  function updateButton(index: number, updates: Partial<EmbedLinkButton>) {
    onChange(
      buttons.map((b, i) => (i === index ? { ...b, ...updates } : b)),
    );
  }

  function moveButton(index: number, direction: -1 | 1) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= buttons.length) return;
    const updated = [...buttons];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    onChange(updated);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Link Buttons ({buttons.length}/5)</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addButton}
          disabled={buttons.length >= 5}
          className="cursor-pointer"
        >
          <Plus className="mr-1 size-3.5" />
          Add Button
        </Button>
      </div>

      {buttons.length === 0 && (
        <p className="text-xs text-muted-foreground">No buttons added yet.</p>
      )}

      <div className="space-y-3">
        {buttons.map((button, i) => (
          <div
            key={i}
            className="space-y-2 rounded-md border border-border bg-sidebar/50 p-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Button {i + 1}
              </span>
              <div className="flex gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => moveButton(i, -1)}
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
                      onClick={() => moveButton(i, 1)}
                      disabled={i === buttons.length - 1}
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
                      onClick={() => removeButton(i)}
                      className="size-7 cursor-pointer p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Remove button</TooltipContent>
                </Tooltip>
              </div>
            </div>

            <Input
              placeholder="Button label"
              value={button.label}
              onChange={(e) => updateButton(i, { label: e.target.value })}
              maxLength={80}
            />
            <Input
              placeholder="https://..."
              value={button.url}
              onChange={(e) => updateButton(i, { url: e.target.value })}
            />
            <Input
              placeholder="Emoji (optional, e.g. 🔗)"
              value={button.emoji ?? ""}
              onChange={(e) =>
                updateButton(i, { emoji: e.target.value || undefined })
              }
              maxLength={32}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
