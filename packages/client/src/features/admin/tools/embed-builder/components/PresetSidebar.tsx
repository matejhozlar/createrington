import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, Search, ChevronRight, MoreHorizontal, FolderPlus, Pencil, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UseEmbedBuilder } from "../hooks/use-embed-builder";

interface PresetSidebarProps {
  builder: UseEmbedBuilder;
}

interface PresetItemProps {
  preset: { id: number; name: string; createdBy: string; data: unknown; categoryId?: number | null };
  isActive: boolean;
  onLoad: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

function PresetItem({ preset, isActive, onLoad, onDelete, onDuplicate }: PresetItemProps) {
  return (
    <div
      className={cn(
        "group flex items-center rounded-md px-2 py-1.5 hover:bg-accent",
        isActive && "bg-accent",
      )}
    >
      <button
        type="button"
        className="min-w-0 flex-1 cursor-pointer text-left"
        onClick={onLoad}
      >
        <p className="truncate text-sm font-medium">{preset.name}</p>
        <p className="truncate text-[11px] text-muted-foreground">
          by {preset.createdBy}
        </p>
      </button>
      <div className="flex shrink-0 gap-0.5 opacity-0 group-hover:opacity-100">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="size-6 cursor-pointer p-0 text-muted-foreground hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate();
          }}
          title="Duplicate"
        >
          <Copy className="size-3" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="size-6 cursor-pointer p-0 text-muted-foreground hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="Delete"
        >
          <Trash2 className="size-3" />
        </Button>
      </div>
    </div>
  );
}

interface CategorySectionProps {
  categoryId: number | "uncategorized";
  name: string;
  presetCount: number;
  activePresetId: number | undefined;
  guardUnsaved: (action: () => void) => void;
  onLoadPreset: (preset: { id: number; name: string; data: unknown; categoryId?: number | null }) => void;
  onDeletePreset: (id: number, name: string) => void;
  onDuplicatePreset: (preset: { id: number; name: string; data: unknown; categoryId?: number | null }) => void;
  onRenameCategory?: () => void;
  onDeleteCategory?: () => void;
}

function CategorySection({
  categoryId,
  name,
  presetCount,
  activePresetId,
  guardUnsaved,
  onLoadPreset,
  onDeletePreset,
  onDuplicatePreset,
  onRenameCategory,
  onDeleteCategory,
}: CategorySectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isUncategorized = categoryId === "uncategorized";

  const presetsQuery = trpc.admin.embeds.presets.list.useQuery(
    {
      categoryId,
      limit: 50,
    },
    { enabled: isOpen },
  );

  const presets = presetsQuery.data?.presets ?? [];

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="flex items-center gap-1">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex flex-1 cursor-pointer items-center gap-1 rounded-md px-2 py-1.5 text-sm hover:bg-accent",
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
                className="size-6 shrink-0 cursor-pointer p-0 text-muted-foreground"
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
            <div className="space-y-1.5 px-2 py-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-3/4" />
            </div>
          ) : presets.length === 0 ? (
            <p className="px-2 py-2 text-xs text-muted-foreground">No presets</p>
          ) : (
            presets.map((preset) => (
              <PresetItem
                key={preset.id}
                preset={preset}
                isActive={activePresetId === preset.id}
                onLoad={() => guardUnsaved(() => onLoadPreset(preset))}
                onDelete={() => onDeletePreset(preset.id, preset.name)}
                onDuplicate={() => onDuplicatePreset(preset)}
              />
            ))
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function PresetSidebar({ builder }: PresetSidebarProps) {
  const {
    search,
    setSearch,
    presetsQuery,
    categoriesQuery,
    activePreset,
    isDirty,
    handleLoadPreset,
    handleNewEmbed,
    handleDeletePreset,
    handleDuplicatePreset,
    handleCreateCategory,
    handleUpdateCategory,
    handleDeleteCategory,
  } = builder;

  const isSearching = !!search;
  const searchResults = presetsQuery.data?.presets ?? [];
  const categories = categoriesQuery.data ?? [];

  // Unsaved-changes confirmation state
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<{
    id: number;
    name: string;
    type: "preset" | "category";
  } | null>(null);

  // Rename category state
  const [renameTarget, setRenameTarget] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [renameName, setRenameName] = useState("");

  // New category state
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  function guardUnsaved(action: () => void) {
    if (isDirty) {
      setPendingAction(() => action);
    } else {
      action();
    }
  }

  const uncategorizedQuery = trpc.admin.embeds.presets.list.useQuery(
    { categoryId: "uncategorized", limit: 1 },
    { enabled: !isSearching },
  );
  const uncategorizedPresetCount = uncategorizedQuery.data?.pagination.total ?? 0;

  return (
    <div className="flex w-64 shrink-0 flex-col border-r border-border bg-card">
      <div className="flex flex-col gap-2 p-3">
        <div className="flex gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 cursor-pointer justify-start"
            onClick={() => guardUnsaved(handleNewEmbed)}
          >
            <Plus className="mr-1.5 size-3.5" />
            New Embed
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer px-2"
            onClick={() => {
              setShowNewCategory(true);
              setNewCategoryName("");
            }}
            title="New Category"
          >
            <FolderPlus className="size-3.5" />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search presets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-1.5 pb-3">
        {/* New category inline input */}
        {showNewCategory && (
          <form
            className="mb-2 flex gap-1 px-1"
            onSubmit={(e) => {
              e.preventDefault();
              if (newCategoryName.trim()) {
                handleCreateCategory(newCategoryName.trim());
                setShowNewCategory(false);
                setNewCategoryName("");
              }
            }}
          >
            <Input
              autoFocus
              placeholder="Category name..."
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              className="h-7 text-xs"
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setShowNewCategory(false);
                  setNewCategoryName("");
                }
              }}
            />
            <Button
              type="submit"
              size="sm"
              className="h-7 cursor-pointer px-2 text-xs"
              disabled={!newCategoryName.trim()}
            >
              Add
            </Button>
          </form>
        )}

        {isSearching ? (
          // Search mode: flat results
          presetsQuery.isLoading ? (
            <div className="space-y-1.5 px-2 py-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-3/4" />
            </div>
          ) : searchResults.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">
              No presets found
            </p>
          ) : (
            <div className="space-y-0.5">
              {searchResults.map((preset) => (
                <PresetItem
                  key={preset.id}
                  preset={preset}
                  isActive={activePreset?.id === preset.id}
                  onLoad={() =>
                    guardUnsaved(() => handleLoadPreset(preset))
                  }
                  onDelete={() =>
                    setDeleteTarget({ id: preset.id, name: preset.name, type: "preset" })
                  }
                  onDuplicate={() => handleDuplicatePreset(preset)}
                />
              ))}
            </div>
          )
        ) : (
          // Category mode
          <div className="space-y-0.5">
            {categoriesQuery.isLoading ? (
              <div className="space-y-2 px-2 py-2">
                <Skeleton className="h-7 w-full" />
                <Skeleton className="h-7 w-full" />
                <Skeleton className="h-7 w-3/4" />
              </div>
            ) : (
              <>
                {categories.map((cat) => (
                  <CategorySection
                    key={cat.id}
                    categoryId={cat.id}
                    name={cat.name}
                    presetCount={cat.presetCount}
                    activePresetId={activePreset?.id}
                    guardUnsaved={guardUnsaved}
                    onLoadPreset={handleLoadPreset}
                    onDeletePreset={(id, name) =>
                      setDeleteTarget({ id, name, type: "preset" })
                    }
                    onDuplicatePreset={handleDuplicatePreset}
                    onRenameCategory={() => {
                      setRenameTarget({ id: cat.id, name: cat.name });
                      setRenameName(cat.name);
                    }}
                    onDeleteCategory={() =>
                      setDeleteTarget({ id: cat.id, name: cat.name, type: "category" })
                    }
                  />
                ))}

                {/* Uncategorized section */}
                <CategorySection
                  categoryId="uncategorized"
                  name="Uncategorized"
                  presetCount={uncategorizedPresetCount}
                  activePresetId={activePreset?.id}
                  guardUnsaved={guardUnsaved}
                  onLoadPreset={handleLoadPreset}
                  onDeletePreset={(id, name) =>
                    setDeleteTarget({ id, name, type: "preset" })
                  }
                  onDuplicatePreset={handleDuplicatePreset}
                />
              </>
            )}
          </div>
        )}
      </div>

      {/* Unsaved changes confirmation */}
      <AlertDialog
        open={!!pendingAction}
        onOpenChange={(open) => {
          if (!open) setPendingAction(null);
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes that will be lost. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                pendingAction?.();
                setPendingAction(null);
              }}
            >
              Discard Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation (preset or category) */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deleteTarget?.type === "category" ? "Category" : "Preset"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === "category" ? (
                <>
                  Are you sure you want to delete the category &ldquo;{deleteTarget?.name}&rdquo;?
                  Presets in this category will become uncategorized.
                </>
              ) : (
                <>
                  Are you sure you want to delete &ldquo;{deleteTarget?.name}
                  &rdquo;? This action cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (deleteTarget) {
                  if (deleteTarget.type === "category") {
                    handleDeleteCategory(deleteTarget.id, deleteTarget.name);
                  } else {
                    handleDeletePreset(deleteTarget.id, deleteTarget.name);
                  }
                }
                setDeleteTarget(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rename category dialog */}
      <AlertDialog
        open={!!renameTarget}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null);
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Rename Category</AlertDialogTitle>
            <AlertDialogDescription>
              Enter a new name for &ldquo;{renameTarget?.name}&rdquo;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-6 pb-2">
            <Input
              autoFocus
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && renameName.trim() && renameTarget) {
                  handleUpdateCategory(renameTarget.id, { name: renameName.trim() });
                  setRenameTarget(null);
                }
              }}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!renameName.trim() || renameName.trim() === renameTarget?.name}
              onClick={() => {
                if (renameTarget && renameName.trim()) {
                  handleUpdateCategory(renameTarget.id, { name: renameName.trim() });
                }
                setRenameTarget(null);
              }}
            >
              Rename
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
