import { Copy, FolderInput, MoreHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface PresetItemProps {
  preset: {
    id: number;
    name: string;
    createdBy: string;
    data: unknown;
    categoryId?: number | null;
  };
  isActive: boolean;
  categories: { id: number; name: string }[];
  onLoad: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMove: (categoryId: number | null) => void;
}

export function PresetItem({
  preset,
  isActive,
  categories,
  onLoad,
  onDelete,
  onDuplicate,
  onMove,
}: PresetItemProps) {
  const moveTargets = categories.filter((c) => c.id !== preset.categoryId);
  const showUncategorizedTarget = preset.categoryId !== null;

  return (
    <div
      className={cn(
        "group flex items-center rounded-md px-2 py-1 hover:bg-accent",
        isActive && "bg-accent",
      )}
    >
      <button
        type="button"
        className="min-w-0 flex-1 text-left"
        onClick={onLoad}
      >
        <p className="truncate text-[13px] font-medium">{preset.name}</p>
        <p className="truncate text-[11px] text-muted-foreground">
          by {preset.createdBy}
        </p>
      </button>
      <div className="flex shrink-0 gap-0.5 opacity-0 group-hover:opacity-100">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="size-6 p-0 text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate();
              }}
            >
              <Copy className="size-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Duplicate</TooltipContent>
        </Tooltip>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="size-6 p-0 text-muted-foreground hover:text-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="size-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <FolderInput className="mr-2 size-3.5" />
                Move to
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {moveTargets.length === 0 && !showUncategorizedTarget ? (
                  <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                    No other categories
                  </DropdownMenuLabel>
                ) : (
                  <>
                    {showUncategorizedTarget && (
                      <DropdownMenuItem onClick={() => onMove(null)}>
                        Uncategorized
                      </DropdownMenuItem>
                    )}
                    {moveTargets.length > 0 && showUncategorizedTarget && (
                      <DropdownMenuSeparator />
                    )}
                    {moveTargets.map((c) => (
                      <DropdownMenuItem key={c.id} onClick={() => onMove(c.id)}>
                        {c.name}
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 size-3.5" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
