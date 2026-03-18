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
import { Plus, Trash2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UseEmbedBuilder } from "../hooks/use-embed-builder";

interface PresetSidebarProps {
  builder: UseEmbedBuilder;
}

export function PresetSidebar({ builder }: PresetSidebarProps) {
  const {
    search,
    setSearch,
    presetsQuery,
    activePreset,
    isDirty,
    handleLoadPreset,
    handleNewEmbed,
    handleDeletePreset,
  } = builder;

  const presets = presetsQuery.data?.presets ?? [];

  // Unsaved-changes confirmation state
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<{
    id: number;
    name: string;
  } | null>(null);

  function guardUnsaved(action: () => void) {
    if (isDirty) {
      setPendingAction(() => action);
    } else {
      action();
    }
  }

  return (
    <div className="flex w-64 shrink-0 flex-col border-r border-border bg-card">
      <div className="flex flex-col gap-2 p-3">
        <Button
          variant="outline"
          size="sm"
          className="w-full cursor-pointer justify-start"
          onClick={() => guardUnsaved(handleNewEmbed)}
        >
          <Plus className="mr-1.5 size-3.5" />
          New Embed
        </Button>
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
        {presetsQuery.isLoading ? (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">
            Loading...
          </p>
        ) : presets.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">
            No presets found
          </p>
        ) : (
          <div className="space-y-0.5">
            {presets.map((preset) => (
              <div
                key={preset.id}
                className={cn(
                  "group flex items-center rounded-md px-2 py-1.5 hover:bg-accent",
                  activePreset?.id === preset.id && "bg-accent",
                )}
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 cursor-pointer text-left"
                  onClick={() =>
                    guardUnsaved(() => handleLoadPreset(preset))
                  }
                >
                  <p className="truncate text-sm font-medium">{preset.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    by {preset.createdBy}
                  </p>
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="size-6 shrink-0 cursor-pointer p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget({ id: preset.id, name: preset.name });
                  }}
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            ))}
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

      {/* Delete preset confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Preset</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{deleteTarget?.name}
              &rdquo;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (deleteTarget) {
                  handleDeletePreset(deleteTarget.id, deleteTarget.name);
                }
                setDeleteTarget(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
