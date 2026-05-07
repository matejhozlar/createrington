import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  FolderInput,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import type { UseEmbedBuilder } from "../hooks/use-embed-builder";

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
      // Storage unavailable — silently ignore.
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

  const uncategorizedQuery = trpc.admin.embeds.presets.list.useQuery(
    { categoryId: "uncategorized", limit: 1 },
    { enabled: !isSearching },
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
                  className="size-6"
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

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            placeholder="Search presets…"
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-[13px]"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-1.5 py-2">
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
                  handleUpdateCategory(renameTarget.id, {
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
                  handleUpdateCategory(renameTarget.id, {
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

function UnsavedDialog({
  pendingAction,
  setPendingAction,
}: {
  pendingAction: (() => void) | null;
  setPendingAction: (next: (() => void) | null) => void;
}) {
  return (
    <AlertDialog
      open={!!pendingAction}
      onOpenChange={(open) => {
        if (!open) setPendingAction(null);
      }}
    >
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
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
            Discard changes
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function SkeletonList() {
  return (
    <div className="space-y-1.5 px-2 py-2">
      <Skeleton className="h-7 w-full" />
      <Skeleton className="h-7 w-full" />
      <Skeleton className="h-7 w-3/4" />
    </div>
  );
}

function CollapsedPresetList({
  activeId,
  onLoad,
}: {
  activeId: number | undefined;
  onLoad: (preset: {
    id: number;
    name: string;
    data: unknown;
    categoryId?: number | null;
  }) => void;
}) {
  const recentQuery = trpc.admin.embeds.presets.list.useQuery({ limit: 6 });
  const recent = recentQuery.data?.presets ?? [];
  return (
    <div className="flex flex-col gap-1">
      {recent.map((p) => {
        const active = activeId === p.id;
        return (
          <Tooltip key={p.id}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onLoad(p)}
                className={cn(
                  "flex size-8 items-center justify-center rounded-md text-[13px] font-semibold uppercase transition-colors",
                  active
                    ? "border border-[var(--border-strong)] bg-card text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {p.name.charAt(0)}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{p.name}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

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

function PresetItem({
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

function CategorySection({
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

  const presetsQuery = trpc.admin.embeds.presets.list.useQuery(
    { categoryId, limit: 50 },
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
              "flex flex-1 items-center gap-1 rounded-md px-2 py-1.5 text-[13px] hover:bg-accent",
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
                className="size-6 shrink-0 p-0 text-muted-foreground"
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
