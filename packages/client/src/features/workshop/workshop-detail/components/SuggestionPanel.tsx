import { useState } from "react";
import { Loader2, Plus, Search, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useToastActions } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { MOD_STATUS_STYLES, REJECT_REASON_LABELS } from "../../format";

export function SuggestionPanel({
  workshop,
}: {
  workshop: { id: number; maxModsPerUser: number };
}) {
  const toast = useToastActions();
  const utils = trpc.useUtils();
  const [searchQuery, setSearchQuery] = useState("");
  const [noteFor, setNoteFor] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery, 400);

  const suggestionsQuery = trpc.user.workshops.mySuggestions.useQuery({
    workshopId: workshop.id,
  });
  const rejectedQuery = trpc.user.workshops.listRejected.useQuery({
    workshopId: workshop.id,
  });
  const suggestions = suggestionsQuery.data ?? [];
  const usedSlots = suggestions.filter((m) => m.status === "pending").length;
  const isFull = usedSlots >= workshop.maxModsPerUser;

  const searchResults = trpc.user.workshops.searchProjects.useQuery(
    { workshopId: workshop.id, query: debouncedSearch },
    { enabled: !isFull && debouncedSearch.length >= 2 },
  );

  const invalidate = () => {
    utils.user.workshops.mySuggestions.invalidate({ workshopId: workshop.id });
    utils.user.workshops.searchProjects.invalidate();
    utils.user.workshops.get.invalidate();
  };

  const suggestMutation = trpc.user.workshops.suggestMod.useMutation({
    onSuccess: (mod) => {
      toast.success(`"${mod.project.name}" suggested, awaiting review`);
      setNoteFor(null);
      setNote("");
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const noteReady = note.trim().length >= 10;
  const confirmSuggest = (projectId: number) => {
    if (!noteReady || suggestMutation.isPending) return;
    suggestMutation.mutate({
      workshopId: workshop.id,
      projectId,
      note: note.trim(),
    });
  };

  const removeMutation = trpc.user.workshops.removeSuggestion.useMutation({
    onSuccess: () => {
      toast.success("Suggestion removed");
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  if (suggestionsQuery.isLoading) {
    return <Skeleton className="h-32 w-full rounded-xl" />;
  }

  return (
    <Card className="border-blue-500/30 bg-blue-500/[0.03]">
      <CardHeader>
        <CardTitle className="text-base">Your suggestions</CardTitle>
        <CardDescription>
          {usedSlots} of {workshop.maxModsPerUser} slots used. Every suggestion
          is reviewed by the team; reviewed ones free their slot up.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {suggestions.length > 0 && (
          <div className="space-y-2">
            {suggestions.map((mod) => {
              const status = MOD_STATUS_STYLES[mod.status];
              const removing =
                removeMutation.isPending &&
                removeMutation.variables?.workshopModId === mod.id;
              return (
                <div
                  key={mod.id}
                  className="flex items-center gap-3 rounded-lg border bg-background/50 p-2.5"
                >
                  {mod.project.thumbnailUrl ? (
                    <img
                      src={mod.project.thumbnailUrl}
                      alt=""
                      className="size-8 rounded"
                    />
                  ) : (
                    <div className="size-8 rounded bg-accent" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {mod.project.name}
                    </div>
                    {mod.status === "rejected" && mod.rejectReason ? (
                      <div className="truncate text-xs text-muted-foreground">
                        {REJECT_REASON_LABELS[mod.rejectReason]}
                        {mod.rejectNote && ` - ${mod.rejectNote}`}
                      </div>
                    ) : (
                      mod.note && (
                        <div className="truncate text-xs text-muted-foreground">
                          {mod.note}
                        </div>
                      )
                    )}
                  </div>
                  {status && (
                    <Badge
                      variant="outline"
                      className={`shrink-0 text-xs ${status.className}`}
                    >
                      {status.label}
                    </Badge>
                  )}
                  {mod.status === "pending" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0"
                      disabled={removeMutation.isPending}
                      onClick={() =>
                        removeMutation.mutate({ workshopModId: mod.id })
                      }
                    >
                      {removing ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <X className="size-3.5" />
                      )}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder={
                isFull
                  ? "All slots used, remove a suggestion to add another"
                  : "Search CurseForge..."
              }
              value={searchQuery}
              disabled={isFull}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {!isFull && (
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {searchResults.isLoading && debouncedSearch.length >= 2 && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Searching...
                </p>
              )}
              {searchResults.data?.map((result) => {
                const blocked =
                  result.rejected || result.claimed || result.inModpack;
                const suggesting =
                  suggestMutation.isPending &&
                  suggestMutation.variables?.projectId === result.id;
                const noteOpen = noteFor === result.id;
                return (
                  <div
                    key={result.id}
                    className={`rounded-md border ${
                      blocked ? "opacity-50" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3 p-2.5">
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
                      <div className="flex shrink-0 items-center gap-1">
                        {result.rejected && (
                          <Badge
                            variant="outline"
                            className="border-red-500/50 text-xs text-red-400"
                          >
                            Rejected
                          </Badge>
                        )}
                        {result.claimed && !result.rejected && (
                          <Badge variant="secondary" className="text-xs">
                            Already suggested
                          </Badge>
                        )}
                        {result.inModpack && (
                          <Badge
                            variant="outline"
                            className="border-green-500/50 text-xs text-green-400"
                          >
                            In base pack
                          </Badge>
                        )}
                        {!blocked && !noteOpen && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={suggestMutation.isPending}
                            onClick={() => {
                              setNoteFor(result.id);
                              setNote("");
                            }}
                          >
                            <Plus className="size-3.5" />
                            Suggest
                          </Button>
                        )}
                      </div>
                    </div>
                    {noteOpen && (
                      <div className="flex items-center gap-2 border-t p-2.5">
                        <Input
                          autoFocus
                          className="h-8 flex-1 text-xs"
                          placeholder="Why this one? What does it add to the pack?"
                          maxLength={500}
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") confirmSuggest(result.id);
                          }}
                        />
                        <Button
                          size="sm"
                          disabled={!noteReady || suggestMutation.isPending}
                          onClick={() => confirmSuggest(result.id)}
                        >
                          {suggesting ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            "Suggest"
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0"
                          onClick={() => setNoteFor(null)}
                        >
                          <X className="size-3.5" />
                        </Button>
                      </div>
                    )}
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
          )}
        </div>

        {(rejectedQuery.data?.length ?? 0) > 0 && (
          <div className="space-y-2 border-t pt-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Ruled out by the team
            </div>
            <div className="space-y-1.5">
              {rejectedQuery.data?.map((mod) => (
                <div key={mod.id} className="flex items-center gap-2.5 text-xs">
                  {mod.project.thumbnailUrl ? (
                    <img
                      src={mod.project.thumbnailUrl}
                      alt=""
                      className="size-6 rounded"
                    />
                  ) : (
                    <div className="size-6 rounded bg-accent" />
                  )}
                  <span className="shrink-0 font-medium">
                    {mod.project.name}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    {mod.rejectReason
                      ? REJECT_REASON_LABELS[mod.rejectReason]
                      : "No reason given"}
                    {mod.rejectNote && ` - ${mod.rejectNote}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
