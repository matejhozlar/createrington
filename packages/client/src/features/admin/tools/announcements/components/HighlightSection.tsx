import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";

export interface Highlight {
  title: string;
  description: string;
}

interface HighlightSectionProps {
  highlights: Highlight[];
  onChange: (next: Highlight[]) => void;
}

const TITLE_MAX = 256;
const DESCRIPTION_MAX = 1024;

export function HighlightSection({
  highlights,
  onChange,
}: HighlightSectionProps) {
  function update(index: number, patch: Partial<Highlight>) {
    onChange(highlights.map((h, i) => (i === index ? { ...h, ...patch } : h)));
  }

  function append() {
    onChange([...highlights, { title: "", description: "" }]);
  }

  function remove(index: number) {
    onChange(highlights.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">✨ Highlights</h3>
        <Button variant="outline" size="sm" onClick={append}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add highlight
        </Button>
      </div>

      {highlights.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Optional freeform fields — each one renders as its own embed section.
        </p>
      ) : (
        <div className="space-y-3">
          {highlights.map((h, i) => (
            <div
              key={i}
              className="space-y-2 rounded-md border border-border p-3"
            >
              <div className="flex items-start gap-2">
                <Input
                  placeholder="Title (e.g. Create: Void Tank was added)"
                  value={h.title}
                  onChange={(e) => update(i, { title: e.target.value })}
                  maxLength={TITLE_MAX}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => remove(i)}
                  aria-label="Remove highlight"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <textarea
                placeholder="Description"
                value={h.description}
                onChange={(e) => update(i, { description: e.target.value })}
                maxLength={DESCRIPTION_MAX}
                rows={3}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <p className="text-right text-[10px] text-muted-foreground">
                {h.description.length}/{DESCRIPTION_MAX}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
