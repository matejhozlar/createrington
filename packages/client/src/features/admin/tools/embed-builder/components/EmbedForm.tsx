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
import { useState } from "react";
import { ColorPicker } from "./ColorPicker";
import { EmbedFieldEditor } from "./EmbedFieldEditor";
import type { EmbedData, EmbedField } from "@createrington/shared/api/embed";

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
  function update(updates: Partial<EmbedData>) {
    onChange({ ...data, ...updates });
  }

  return (
    <div className="space-y-1 rounded-lg border border-border bg-card">
      {/* Body */}
      <Section title="Body" defaultOpen>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              placeholder="Embed title"
              value={data.title ?? ""}
              onChange={(e) => update({ title: e.target.value || undefined })}
              maxLength={256}
            />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <textarea
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
            <Label>Author Name</Label>
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
            <Label>Footer Text</Label>
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
