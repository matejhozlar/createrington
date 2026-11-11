import { useState } from "react";
import { ChevronRight, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { PresetItem } from "./PresetItem";
import { SkeletonList } from "./SkeletonList";

interface CategorySectionProps {
  categoryId: number | "uncategorized";
  name: string;
  presetCount: number;
  activePresetId: number | undefined;
  categories: { id: number; name: string }[];
  guardUnsaved: (action: () => void) => void;
  onLoadPreset: (preset: {
    id: number;
    name: string;
    data: unknown;
    categoryId?: number | null;
  }) => void;
  onDeletePreset: (id: number, name: string) => void;
  onDuplicatePreset: (preset: {
    id: number;
    name: string;
    data: unknown;
    categoryId?: number | null;
  }) => void;
  onMovePreset: (presetId: number, categoryId: number | null) => void;
  onRenameCategory?: () => void;
  onDeleteCategory?: () => void;
}

export function CategorySection({
  categoryId,
  name,
  presetCount,
  activePresetId,
  categories,
  guardUnsaved,
  onLoadPreset,
  onDeletePreset,
  onDuplicatePreset,
  onMovePreset,
  onRenameCategory,
  onDeleteCategory,
}: CategorySectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isUncategorized = categoryId === "uncategorized";

  const presetsQuery = useQuery(
    trpc.admin.embeds.presets.list.queryOptions(
      { categoryId, limit: 50 },
      { enabled: isOpen },
    ),
  );
  const presets = presetsQuery.data?.presets ?? [];

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="flex items-center gap-1">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex flex-1 items-center gap-1 rounded-md px-2 py-1.5 text-[13px] hover:bg-accent pointer-coarse:py-2.5",
              isUncategorized && "text-muted-foreground",
            )}
          >
            <ChevronRight
              className={cn(
                "size-3.5 shrink-0 transition-transform",
                isOpen && "rotate-90",
              )}
            />
            <span className="truncate font-medium">{name}</span>
            <span className="ml-auto shrink-0 text-xs text-muted-foreground">
              {presetCount}
            </span>
          </button>
        </CollapsibleTrigger>
        {!isUncategorized && (onRenameCategory || onDeleteCategory) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="size-6 shrink-0 p-0 text-muted-foreground pointer-coarse:size-9"
              >
                <MoreHorizontal className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onRenameCategory && (
                <DropdownMenuItem onClick={onRenameCategory}>
                  <Pencil className="mr-2 size-3.5" />
                  Rename
                </DropdownMenuItem>
              )}
              {onDeleteCategory && (
                <DropdownMenuItem
                  onClick={onDeleteCategory}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 size-3.5" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <CollapsibleContent>
        <div className="ml-3 space-y-0.5 border-l border-border pl-1">
          {presetsQuery.isLoading ? (
            <SkeletonList />
          ) : presets.length === 0 ? (
            <p className="px-2 py-2 text-xs text-muted-foreground">
              No presets
            </p>
          ) : (
            presets.map((preset) => (
              <PresetItem
                key={preset.id}
                preset={preset}
                isActive={activePresetId === preset.id}
                categories={categories}
                onLoad={() => guardUnsaved(() => onLoadPreset(preset))}
                onDelete={() => onDeletePreset(preset.id, preset.name)}
                onDuplicate={() => onDuplicatePreset(preset)}
                onMove={(catId) => onMovePreset(preset.id, catId)}
              />
            ))
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
