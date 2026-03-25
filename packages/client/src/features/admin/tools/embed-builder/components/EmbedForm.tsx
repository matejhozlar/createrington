import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRef, useState } from "react";
import { ColorPicker } from "./ColorPicker";
import { EmbedFieldEditor } from "./EmbedFieldEditor";
import { InsertMenu } from "@/features/admin/components/InsertMenu";
import type { EmbedData, EmbedField } from "@createrington/shared/api/embed";

function CharCount({ value, max }: { value: string | undefined; max: number }) {
  const len = value?.length ?? 0;
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

interface EmbedFormProps {
  data: EmbedData;
  onChange: (data: EmbedData) => void;
}

function Section({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between rounded-md px-3 py-2 text-sm font-medium hover:bg-accent">
        {title}
        <ChevronDown
          className={cn("size-4 transition-transform", open && "rotate-180")}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 px-3 pb-3 pt-1">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function EmbedForm({ data, onChange }: EmbedFormProps) {
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  function update(updates: Partial<EmbedData>) {
    onChange({ ...data, ...updates });
  }

  function insertAtCursor(
    ref: React.RefObject<HTMLTextAreaElement | null>,
    currentValue: string | undefined,
    mention: string,
    field: keyof EmbedData,
  ) {
    const el = ref.current;
    const value = currentValue ?? "";
    const pos = el?.selectionStart ?? value.length;
    const newValue = value.slice(0, pos) + mention + value.slice(pos);
    update({ [field]: newValue || undefined });

    // Restore cursor position after React re-render
    requestAnimationFrame(() => {
      if (el) {
        const newPos = pos + mention.length;
        el.selectionStart = newPos;
        el.selectionEnd = newPos;
        el.focus();
      }
    });
  }

  return (
    <div className="space-y-1 rounded-lg border border-border bg-card">
      {/* Body */}
      <Section title="Body" defaultOpen>
        <div className="space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Title</Label>
              <CharCount value={data.title} max={256} />
            </div>
            <Input
              placeholder="Embed title"
              value={data.title ?? ""}
              onChange={(e) => update({ title: e.target.value || undefined })}
              maxLength={256}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Label>Description</Label>
                <InsertMenu
                  onInsert={(text) =>
                    insertAtCursor(
                      descriptionRef,
                      data.description,
                      text,
                      "description",
                    )
                  }
                />
              </div>
              <CharCount value={data.description} max={4096} />
            </div>
            <textarea
              ref={descriptionRef}
              placeholder="Embed description"
              value={data.description ?? ""}
              onChange={(e) =>
                update({ description: e.target.value || undefined })
              }
              rows={4}
              maxLength={4096}
              className="border-input bg-transparent placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
            />
          </div>
          <div className="space-y-2">
            <Label>URL (title becomes a link)</Label>
            <Input
              placeholder="https://..."
              value={data.url ?? ""}
              onChange={(e) => update({ url: e.target.value || undefined })}
            />
          </div>
          <ColorPicker
            value={data.color}
            onChange={(color) => update({ color })}
          />
        </div>
      </Section>

      {/* Author */}
      <Section title="Author">
        <div className="space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Author Name</Label>
              <CharCount value={data.author} max={256} />
            </div>
            <Input
              placeholder="Author name"
              value={data.author ?? ""}
              onChange={(e) => update({ author: e.target.value || undefined })}
              maxLength={256}
            />
          </div>
          <div className="space-y-2">
            <Label>Author URL</Label>
            <Input
              placeholder="https://..."
              value={data.authorUrl ?? ""}
              onChange={(e) =>
                update({ authorUrl: e.target.value || undefined })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Author Icon URL</Label>
            <Input
              placeholder="https://..."
              value={data.authorIconUrl ?? ""}
              onChange={(e) =>
                update({ authorIconUrl: e.target.value || undefined })
              }
            />
          </div>
        </div>
      </Section>

      {/* Fields */}
      <Section title="Fields">
        <EmbedFieldEditor
          fields={data.fields}
          onChange={(fields: EmbedField[]) => update({ fields })}
        />
      </Section>

      {/* Images */}
      <Section title="Images">
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Thumbnail URL</Label>
            <Input
              placeholder="https://..."
              value={data.thumbnailUrl ?? ""}
              onChange={(e) =>
                update({ thumbnailUrl: e.target.value || undefined })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Image URL</Label>
            <Input
              placeholder="https://..."
              value={data.imageUrl ?? ""}
              onChange={(e) =>
                update({ imageUrl: e.target.value || undefined })
              }
            />
          </div>
        </div>
      </Section>

      {/* Footer */}
      <Section title="Footer">
        <div className="space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Footer Text</Label>
              <CharCount value={data.footer} max={2048} />
            </div>
            <Input
              placeholder="Footer text"
              value={data.footer ?? ""}
              onChange={(e) => update({ footer: e.target.value || undefined })}
              maxLength={2048}
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="embed-timestamp"
              checked={data.timestamp}
              onCheckedChange={(checked) =>
                update({ timestamp: checked === true })
              }
            />
            <label
              htmlFor="embed-timestamp"
              className="cursor-pointer text-sm text-muted-foreground"
            >
              Include timestamp
            </label>
          </div>
        </div>
      </Section>
    </div>
  );
}
