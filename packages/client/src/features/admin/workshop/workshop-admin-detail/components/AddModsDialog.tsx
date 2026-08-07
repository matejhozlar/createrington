import { useState } from "react";
import { Loader2, Plus, Search, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useToastActions } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ProjectThumb } from "@/features/workshop/components/ProjectThumb";
import { MOD_STATUS_STYLES } from "@/features/workshop/format";

interface SelectedProject {
  id: number;
  name: string;
  thumbnailUrl: string | null;
}

const MAX_MODS_PER_ADD = 20;

export function AddModsDialog({
  open,
  onOpenChange,
  workshopId,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workshopId: number;
  onAdded: () => void;
}) {
  const toast = useToastActions();

  const [selected, setSelected] = useState<SelectedProject[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery.trim(), 400);

  const searchResults = trpc.admin.workshops.searchProjects.useQuery(
    { workshopId, query: debouncedSearch },
    { enabled: open && debouncedSearch.length >= 2 },
  );

  const addMutation = trpc.admin.workshops.addMods.useMutation({
    onSuccess: (mods) => {
      toast.success(
        `Added ${mods.length} mod${mods.length !== 1 ? "s" : ""} as approved`,
      );
      onAdded();
      setSelected([]);
      setSearchQuery("");
      onOpenChange(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const handleClose = (next: boolean) => {
    if (!next && !addMutation.isPending) {
      setSelected([]);
      setSearchQuery("");
    }
    if (!addMutation.isPending) onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="max-h-[85vh] max-w-2xl overflow-y-auto"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Add Mods to the Pack</DialogTitle>
          <DialogDescription>
            Mods added here skip review and land directly as approved.
          </DialogDescription>
        </DialogHeader>

        {selected.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selected.map((project) => (
              <Badge
                key={project.id}
                variant="secondary"
                className="gap-1.5 py-1 pl-1.5"
              >
                {project.thumbnailUrl && (
                  <img
                    src={project.thumbnailUrl}
                    alt=""
                    className="size-4 rounded-sm"
                  />
                )}
                {project.name}
                <button
                  type="button"
                  onClick={() =>
                    setSelected((prev) =>
                      prev.filter((p) => p.id !== project.id),
                    )
                  }
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search CurseForge..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="max-h-72 space-y-2 overflow-y-auto">
          {searchResults.isLoading && debouncedSearch.length >= 2 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Searching...
            </p>
          )}
          {searchResults.error && (
            <p className="py-4 text-center text-sm text-destructive">
              Search failed. Try again in a moment.
            </p>
          )}
          {searchResults.data?.map((result) => {
            const alreadySelected = selected.some((p) => p.id === result.id);
            const blocked =
              result.rejected ||
              result.claimed ||
              result.inModpack ||
              alreadySelected;
            return (
              <button
                key={result.id}
                type="button"
                disabled={blocked}
                className={`flex w-full items-center gap-3 rounded-md border p-2.5 text-left ${
                  blocked ? "opacity-50" : "cursor-pointer hover:bg-accent/50"
                }`}
                onClick={() => {
                  if (selected.length >= MAX_MODS_PER_ADD) {
                    toast.error(
                      `You can add up to ${MAX_MODS_PER_ADD} mods at a time`,
                    );
                    return;
                  }
                  setSelected((prev) => [
                    ...prev,
                    {
                      id: result.id,
                      name: result.name,
                      thumbnailUrl: result.thumbnailUrl ?? null,
                    },
                  ]);
                }}
              >
                <ProjectThumb
                  name={result.name}
                  thumbnailUrl={result.thumbnailUrl}
                  className="size-9 rounded text-xs"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {result.name}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {result.slug}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  {result.rejected && (
                    <Badge
                      variant="outline"
                      className={`text-xs ${MOD_STATUS_STYLES.rejected.className}`}
                    >
                      {MOD_STATUS_STYLES.rejected.label}
                    </Badge>
                  )}
                  {result.claimed && !result.rejected && (
                    <Badge variant="secondary" className="text-xs">
                      In workshop
                    </Badge>
                  )}
                  {result.inModpack && (
                    <Badge
                      variant="outline"
                      className={`text-xs ${MOD_STATUS_STYLES.live.className}`}
                    >
                      In base pack
                    </Badge>
                  )}
                  {alreadySelected && (
                    <Badge variant="secondary" className="text-xs">
                      Selected
                    </Badge>
                  )}
                  {!blocked && (
                    <Plus className="size-4 text-muted-foreground" />
                  )}
                </div>
              </button>
            );
          })}
          {debouncedSearch.length >= 2 &&
            !searchResults.isLoading &&
            searchResults.data?.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No compatible mods found
              </p>
            )}
        </div>

        <DialogFooter>
          <Button
            onClick={() =>
              addMutation.mutate({
                workshopId,
                projectIds: selected.map((p) => p.id),
              })
            }
            disabled={addMutation.isPending || selected.length === 0}
          >
            {addMutation.isPending && (
              <Loader2 className="size-4 animate-spin" />
            )}
            Add {selected.length > 0 ? `${selected.length} ` : ""}as Approved
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
