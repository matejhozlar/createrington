import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  CopyPlus,
  Layers,
  Plus,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Catalog } from "../engine/assets";
import type { TextType, TitleLayer } from "../engine/types";

const TYPE_LABELS: Record<TextType, string> = {
  top: "Top",
  bottom: "Bottom",
  small: "Small",
};

const ADD_OPTIONS: { type: TextType; description: string }[] = [
  { type: "top", description: "The main title" },
  {
    type: "bottom",
    description: "Lies flat underneath, like the edition text",
  },
  { type: "small", description: "A subtitle below the title" },
];

export function LayerList({
  layers,
  selectedId,
  catalog,
  onSelect,
  onAdd,
  onDuplicate,
  onRemove,
  onMove,
}: {
  layers: TitleLayer[];
  selectedId: string;
  catalog: Catalog | undefined;
  onSelect: (id: string) => void;
  onAdd: (type: TextType) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
}) {
  return (
    <Card className="gap-2">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Layers className="size-4 text-muted-foreground" />
          Texts
        </CardTitle>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="size-4" />
              Add text
              <ChevronDown className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {ADD_OPTIONS.map(({ type, description }) => (
              <DropdownMenuItem
                key={type}
                onSelect={() => onAdd(type)}
                className="flex flex-col items-start gap-0.5"
              >
                <span className="font-medium">{TYPE_LABELS[type]}</span>
                <span className="text-xs text-muted-foreground">
                  {description}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {layers.map((layer, index) => (
          <div
            key={layer.id}
            className={cn(
              "group flex items-center gap-2 rounded-xl border border-border bg-card py-2 pr-2 pl-3 transition-colors hover:border-primary/40",
              layer.id === selectedId && "border-primary hover:border-primary",
            )}
          >
            <button
              type="button"
              onClick={() => onSelect(layer.id)}
              className="flex min-w-0 flex-1 cursor-pointer flex-col items-start gap-1 text-left focus-visible:outline-none"
            >
              <span className="w-full truncate font-medium">
                {layer.text.trim() || "Untitled text"}
              </span>
              <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <Badge
                  variant="outline"
                  className="border-transparent bg-foreground/10"
                >
                  {TYPE_LABELS[layer.type]}
                </Badge>
                {catalog?.fonts[layer.font]?.name ?? layer.font}
              </span>
            </button>
            <div className="flex shrink-0 items-center">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Move up"
                disabled={index === 0}
                onClick={() => onMove(layer.id, -1)}
              >
                <ArrowUp className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Move down"
                disabled={index === layers.length - 1}
                onClick={() => onMove(layer.id, 1)}
              >
                <ArrowDown className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Duplicate"
                onClick={() => onDuplicate(layer.id)}
              >
                <CopyPlus className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Delete"
                disabled={layers.length <= 1}
                onClick={() => onRemove(layer.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
