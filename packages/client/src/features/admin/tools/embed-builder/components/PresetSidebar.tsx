import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, FolderPlus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/search-input";
import { Input } from "@/components/ui/input";
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import type { UseEmbedBuilder } from "../hooks/use-embed-builder";
import { useQuery } from "@tanstack/react-query";
import { UnsavedDialog } from "./preset-sidebar/UnsavedDialog";
import { SkeletonList } from "./preset-sidebar/SkeletonList";
import { CollapsedPresetList } from "./preset-sidebar/CollapsedPresetList";
import { PresetItem } from "./preset-sidebar/PresetItem";
import { CategorySection } from "./preset-sidebar/CategorySection";

const RAIL_COLLAPSED_KEY = "embed-builder.rail-collapsed";

interface PresetSidebarProps {
  builder: UseEmbedBuilder;
  className?: string;
  onNavigate?: () => void;
  forceExpanded?: boolean;
}

export function PresetSidebar({
  builder,
  className,
  onNavigate,
  forceExpanded,
}: PresetSidebarProps) {
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
    handleSetPresetCategory,
  } = builder;

  const [collapsed, setCollapsed] = useState(() => {
    if (forceExpanded) return false;
    if (typeof window === "undefined") return false;
    return localStorage.getItem(RAIL_COLLAPSED_KEY) === "1";
  });

  useEffect(() => {
    if (forceExpanded) return;
    try {
      localStorage.setItem(RAIL_COLLAPSED_KEY, collapsed ? "1" : "0");
    } catch {
      // Storage unavailable, silently ignore.
    }
  }, [collapsed, forceExpanded]);

  const isSearching = !!search;
  const searchResults = presetsQuery.data?.presets ?? [];
  const categories = categoriesQuery.data ?? [];

  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: number;
    name: string;
    type: "preset" | "category";
  } | null>(null);
  const [renameTarget, setRenameTarget] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [renameName, setRenameName] = useState("");
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  function guardUnsaved(action: () => void) {
    if (isDirty) setPendingAction(() => action);
    else action();
  }

  function loadAndNavigate(preset: {
    id: number;
    name: string;
    data: unknown;
    categoryId?: number | null;
  }) {
    handleLoadPreset(preset);
    onNavigate?.();
  }

  const uncategorizedQuery = useQuery(
    trpc.admin.embeds.presets.list.queryOptions(
      { categoryId: "uncategorized", limit: 1 },
      { enabled: !isSearching },
    ),
  );
  const uncategorizedTotal = uncategorizedQuery.data?.pagination.total ?? 0;

  if (collapsed && !forceExpanded) {
    return (
      <aside
        className={cn(
          "flex w-[52px] shrink-0 flex-col items-center gap-1.5 border-r border-border bg-sidebar py-2",
          className,
        )}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-9"
              onClick={() => setCollapsed(false)}
              aria-label="Expand presets"
            >
              <ChevronRight className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Expand presets</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-9"
              onClick={() => guardUnsaved(handleNewEmbed)}
              aria-label="New embed"
            >
              <Plus className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">New embed</TooltipContent>
        </Tooltip>
        <div className="my-1 h-px w-6 bg-border" />
        <CollapsedPresetList
          activeId={activePreset?.id}
          onLoad={(p) => guardUnsaved(() => loadAndNavigate(p))}
        />

        <UnsavedDialog
          pendingAction={pendingAction}
          setPendingAction={setPendingAction}
        />
      </aside>
    );
  }

  return (
    <aside
      className={cn(
        "flex w-[240px] shrink-0 flex-col border-r border-border bg-sidebar",
        className,
      )}
    >
      <div className="flex flex-col gap-2 border-b border-border p-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Presets
          </h2>
          <div className="flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 pointer-coarse:size-9"
                  onClick={() => {
                    setShowNewCategory(true);
                    setNewCategoryName("");
                  }}
                  aria-label="New category"
                >
                  <FolderPlus className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">New category</TooltipContent>
            </Tooltip>
            {!forceExpanded && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    onClick={() => setCollapsed(true)}
                    aria-label="Collapse presets"
                  >
                    <ChevronLeft className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Collapse</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start"
          onClick={() => guardUnsaved(handleNewEmbed)}
        >
          <Plus className="mr-1.5 size-3.5" />
          New embed
        </Button>

        <SearchInput
          value={search}
          placeholder="Search presets…"
          onValueChange={setSearch}
          iconClassName="left-2.5 size-3.5"
          inputClassName="h-8 pl-8 text-[13px]"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-1.5 py-2">
        {showNewCategory && (
          <form
            className="mb-2 flex gap-1 px-1"
            onSubmit={(e) => {
              e.preventDefault();
              if (newCategoryName.trim()) {
                void handleCreateCategory(newCategoryName.trim());
                setShowNewCategory(false);
                setNewCategoryName("");
              }
            }}
          >
            <Input
              autoFocus
              placeholder="Category name…"
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
              className="h-7 px-2 text-xs"
              disabled={!newCategoryName.trim()}
            >
              Add
            </Button>
          </form>
        )}

        {isSearching ? (
          presetsQuery.isLoading ? (
            <SkeletonList />
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
                  categories={categories}
                  onLoad={() => guardUnsaved(() => loadAndNavigate(preset))}
                  onDelete={() =>
                    setDeleteTarget({
                      id: preset.id,
                      name: preset.name,
                      type: "preset",
                    })
                  }
                  onDuplicate={() => handleDuplicatePreset(preset)}
                  onMove={(catId) => handleSetPresetCategory(preset.id, catId)}
                />
              ))}
            </div>
          )
        ) : (
          <div className="space-y-0.5">
            {categoriesQuery.isLoading ? (
              <SkeletonList />
            ) : (
              <>
                {categories.map((cat) => (
                  <CategorySection
                    key={cat.id}
                    categoryId={cat.id}
                    name={cat.name}
                    presetCount={cat.presetCount}
                    activePresetId={activePreset?.id}
                    categories={categories}
                    guardUnsaved={guardUnsaved}
                    onLoadPreset={loadAndNavigate}
                    onDeletePreset={(id, name) =>
                      setDeleteTarget({ id, name, type: "preset" })
                    }
                    onDuplicatePreset={handleDuplicatePreset}
                    onMovePreset={handleSetPresetCategory}
                    onRenameCategory={() => {
                      setRenameTarget({ id: cat.id, name: cat.name });
                      setRenameName(cat.name);
                    }}
                    onDeleteCategory={() =>
                      setDeleteTarget({
                        id: cat.id,
                        name: cat.name,
                        type: "category",
                      })
                    }
                  />
                ))}
                <CategorySection
                  categoryId="uncategorized"
                  name="Uncategorized"
                  presetCount={uncategorizedTotal}
                  activePresetId={activePreset?.id}
                  categories={categories}
                  guardUnsaved={guardUnsaved}
                  onLoadPreset={loadAndNavigate}
                  onDeletePreset={(id, name) =>
                    setDeleteTarget({ id, name, type: "preset" })
                  }
                  onDuplicatePreset={handleDuplicatePreset}
                  onMovePreset={handleSetPresetCategory}
                />
              </>
            )}
          </div>
        )}
      </div>

      <UnsavedDialog
        pendingAction={pendingAction}
        setPendingAction={setPendingAction}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deleteTarget?.type === "category" ? "category" : "preset"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === "category" ? (
                <>
                  Delete the category &ldquo;{deleteTarget?.name}&rdquo;?
                  Presets in this category will become uncategorized.
                </>
              ) : (
                <>
                  Delete &ldquo;{deleteTarget?.name}&rdquo;? This action cannot
                  be undone.
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
                    void handleDeleteCategory(
                      deleteTarget.id,
                      deleteTarget.name,
                    );
                  } else {
                    void handleDeletePreset(deleteTarget.id, deleteTarget.name);
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

      <AlertDialog
        open={!!renameTarget}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null);
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Rename category</AlertDialogTitle>
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
                  void handleUpdateCategory(renameTarget.id, {
                    name: renameName.trim(),
                  });
                  setRenameTarget(null);
                }
              }}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={
                !renameName.trim() || renameName.trim() === renameTarget?.name
              }
              onClick={() => {
                if (renameTarget && renameName.trim()) {
                  void handleUpdateCategory(renameTarget.id, {
                    name: renameName.trim(),
                  });
                }
                setRenameTarget(null);
              }}
            >
              Rename
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}
