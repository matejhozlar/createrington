import { useMemo, useState } from "react";
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

interface BuilderEntry {
  projectId: number;
  name: string;
  thumbnailUrl: string | null;
  note: string;
}

interface SubmissionMod {
  status: string;
  note: string | null;
  curseforgeProjectId: number;
  project: { name: string; thumbnailUrl: string | null };
}

export function SubmissionBuilderDialog({
  open,
  onOpenChange,
  vote,
  submission,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vote: { id: number; maxModsPerSubmission: number };
  submission: { mods: SubmissionMod[] } | null;
}) {
  const toast = useToastActions();
  const utils = trpc.useUtils();

  // Parent remounts this dialog per open, so initializing from props is safe
  const [entries, setEntries] = useState<BuilderEntry[]>(() =>
    (submission?.mods ?? [])
      .filter((m) => m.status === "pending")
      .map((m) => ({
        projectId: m.curseforgeProjectId,
        name: m.project.name,
        thumbnailUrl: m.project.thumbnailUrl,
        note: m.note ?? "",
      })),
  );
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery, 400);

  const lockedCount = useMemo(
    () => (submission?.mods ?? []).filter((m) => m.status !== "pending").length,
    [submission],
  );
  const maxEditable = vote.maxModsPerSubmission - lockedCount;
  const isFull = entries.length >= maxEditable;

  const searchResults = trpc.user.votes.searchProjects.useQuery(
    { voteId: vote.id, query: debouncedSearch },
    { enabled: open && debouncedSearch.length >= 2 },
  );

  const invalidate = () => {
    utils.user.votes.mySubmission.invalidate({ voteId: vote.id });
    utils.user.votes.get.invalidate();
  };

  const createMutation = trpc.user.votes.createSubmission.useMutation({
    onSuccess: () => {
      toast.success("Submission created, awaiting review");
      invalidate();
      onOpenChange(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.user.votes.updateSubmission.useMutation({
    onSuccess: () => {
      toast.success("Submission updated");
      invalidate();
      onOpenChange(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const saving = createMutation.isPending || updateMutation.isPending;

  const handleSave = () => {
    const mods = entries.map((e) => ({
      projectId: e.projectId,
      note: e.note.trim() ? e.note.trim() : undefined,
    }));
    if (submission) {
      updateMutation.mutate({ voteId: vote.id, mods });
    } else {
      createMutation.mutate({ voteId: vote.id, mods });
    }
  };

  const addEntry = (result: {
    id: number;
    name: string;
    thumbnailUrl?: string;
  }) => {
    if (isFull || entries.some((e) => e.projectId === result.id)) return;
    setEntries((prev) => [
      ...prev,
      {
        projectId: result.id,
        name: result.name,
        thumbnailUrl: result.thumbnailUrl ?? null,
        note: "",
      },
    ]);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {submission ? "Edit your submission" : "Suggest mods"}
          </DialogTitle>
          <DialogDescription>
            Pick up to {maxEditable} mod{maxEditable !== 1 && "s"} from
            CurseForge. Every suggestion is reviewed by the team before it joins
            the pack.
          </DialogDescription>
        </DialogHeader>

        {entries.length > 0 && (
          <div className="space-y-2">
            {entries.map((entry) => (
              <div
                key={entry.projectId}
                className="flex items-center gap-3 rounded-lg border p-2.5"
              >
                {entry.thumbnailUrl ? (
                  <img
                    src={entry.thumbnailUrl}
                    alt=""
                    className="size-9 rounded"
                  />
                ) : (
                  <div className="size-9 rounded bg-accent" />
                )}
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="truncate text-sm font-medium">
                    {entry.name}
                  </div>
                  <Input
                    className="h-7 text-xs"
                    placeholder="Why this mod? (optional)"
                    maxLength={500}
                    value={entry.note}
                    onChange={(e) =>
                      setEntries((prev) =>
                        prev.map((p) =>
                          p.projectId === entry.projectId
                            ? { ...p, note: e.target.value }
                            : p,
                        ),
                      )
                    }
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0"
                  onClick={() =>
                    setEntries((prev) =>
                      prev.filter((p) => p.projectId !== entry.projectId),
                    )
                  }
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder={
                isFull
                  ? "Submission is full, remove a mod to add another"
                  : "Search CurseForge..."
              }
              value={searchQuery}
              disabled={isFull}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="max-h-64 space-y-2 overflow-y-auto">
            {searchResults.isLoading && debouncedSearch.length >= 2 && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Searching...
              </p>
            )}
            {searchResults.data?.map((result) => {
              const alreadyAdded = entries.some(
                (e) => e.projectId === result.id,
              );
              const blocked =
                result.banned ||
                result.claimed ||
                result.inModpack ||
                alreadyAdded;
              return (
                <div
                  key={result.id}
                  className={`flex items-center gap-3 rounded-md border p-2.5 ${
                    blocked || isFull
                      ? "opacity-50"
                      : "cursor-pointer hover:bg-accent/50"
                  }`}
                  onClick={() => !blocked && addEntry(result)}
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
                        Rejected
                      </Badge>
                    )}
                    {result.claimed && !result.banned && (
                      <Badge variant="secondary" className="text-xs">
                        Already suggested
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
                    {alreadyAdded && (
                      <Badge variant="secondary" className="text-xs">
                        Added
                      </Badge>
                    )}
                    {!blocked && !isFull && (
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
        </div>

        <DialogFooter className="items-center gap-2 sm:justify-between">
          <span className="text-xs text-muted-foreground">
            {entries.length + lockedCount}/{vote.maxModsPerSubmission} mods
            {lockedCount > 0 && ` (${lockedCount} already reviewed)`}
          </span>
          <Button
            onClick={handleSave}
            disabled={saving || entries.length === 0}
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            {submission ? "Save changes" : "Submit for review"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
