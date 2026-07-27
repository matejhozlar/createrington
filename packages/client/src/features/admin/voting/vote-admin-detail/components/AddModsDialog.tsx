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

interface SelectedProject {
  id: number;
  name: string;
  thumbnailUrl: string | null;
}

export function AddModsDialog({
  open,
  onOpenChange,
  voteId,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  voteId: number;
  onAdded: () => void;
}) {
  const toast = useToastActions();

  const [selected, setSelected] = useState<SelectedProject[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery, 400);

  const searchResults = trpc.admin.votes.searchProjects.useQuery(
    { voteId, query: debouncedSearch },
    { enabled: open && debouncedSearch.length >= 2 },
  );

  const addMutation = trpc.admin.votes.addMods.useMutation({
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
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add mods to the pack</DialogTitle>
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
          {searchResults.data?.map((result) => {
            const alreadySelected = selected.some((p) => p.id === result.id);
            const blocked =
              result.banned ||
              result.claimed ||
              result.inModpack ||
              alreadySelected;
            return (
              <div
                key={result.id}
                className={`flex items-center gap-3 rounded-md border p-2.5 ${
                  blocked ? "opacity-50" : "cursor-pointer hover:bg-accent/50"
                }`}
                onClick={() =>
                  !blocked &&
                  setSelected((prev) => [
                    ...prev,
                    {
                      id: result.id,
                      name: result.name,
                      thumbnailUrl: result.thumbnailUrl ?? null,
                    },
                  ])
                }
              >
                {result.thumbnailUrl && (
                  <img
                    src={result.thumbnailUrl}
                    alt=""
                    className="size-9 rounded"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {result.name}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {result.slug}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  {result.banned && (
                    <Badge
                      variant="outline"
                      className="border-red-500/50 text-xs text-red-400"
                    >
                      Banned
                    </Badge>
                  )}
                  {result.claimed && !result.banned && (
                    <Badge variant="secondary" className="text-xs">
                      In vote
                    </Badge>
                  )}
                  {result.inModpack && (
                    <Badge
                      variant="outline"
                      className="border-green-500/50 text-xs text-green-400"
                    >
                      In modpack
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
              </div>
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
                voteId,
                projectIds: selected.map((p) => p.id),
              })
            }
            disabled={addMutation.isPending || selected.length === 0}
          >
            {addMutation.isPending && (
              <Loader2 className="size-4 animate-spin" />
            )}
            Add {selected.length > 0 ? `${selected.length} ` : ""}as approved
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
