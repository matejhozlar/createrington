import { useEffect, useRef, useState } from "react";
import { Info, Loader2, Search, X } from "lucide-react";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useToastActions } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProjectThumb } from "../../components/ProjectThumb";
import { formatDownloads } from "../../format";

type Suggestion = RouterOutput["user"]["workshops"]["mySuggestions"][number];
type SearchResult = RouterOutput["user"]["workshops"]["searchProjects"][number];

export function ModSearch({
  workshop,
  suggestions,
  packProjectIds,
  initialQuery,
}: {
  workshop: { id: number; maxModsPerUser: number };
  suggestions: Suggestion[];
  packProjectIds: Set<number>;
  initialQuery: string;
}) {
  const toast = useToastActions();
  const utils = trpc.useUtils();
  const containerRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [dismissed, setDismissed] = useState(false);
  const [noteFor, setNoteFor] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery.trim(), 400);

  const usedSlots = suggestions.filter((m) => m.status === "pending").length;
  const isFull = usedSlots >= workshop.maxModsPerUser;
  const ownProjectIds = new Set(suggestions.map((m) => m.curseforgeProjectId));
  const searching = !isFull && debouncedSearch.length >= 2;
  const dropdownOpen = searching && !dismissed;

  const searchResults = trpc.user.workshops.searchProjects.useQuery(
    { workshopId: workshop.id, query: debouncedSearch },
    { enabled: searching },
  );

  useEffect(() => {
    if (!dropdownOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setDismissed(true);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [dropdownOpen]);

  const suggestMutation = trpc.user.workshops.suggestMod.useMutation({
    onSuccess: (mod) => {
      toast.success(`"${mod.project.name}" suggested, awaiting review`);
      setNoteFor(null);
      setNote("");
      utils.user.workshops.mySuggestions.invalidate({
        workshopId: workshop.id,
      });
      utils.user.workshops.mySuggestionHistory.invalidate();
      utils.user.workshops.searchProjects.invalidate();
      utils.user.workshops.get.invalidate();
      utils.user.workshops.list.invalidate();
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

  const resultState = (result: SearchResult): string | null => {
    if (packProjectIds.has(result.id) || result.inModpack) {
      return "Already in the pack";
    }
    if (result.rejected) return "Ruled out by the team";
    if (ownProjectIds.has(result.id)) return "In your suggestions";
    if (result.claimed) return "Already suggested";
    return null;
  };

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-[22px] leading-7 font-semibold">Find a mod</h2>
        <p className="mt-1.5 text-[13px] text-muted-foreground">
          Search CurseForge by mod name or author.
        </p>
      </div>

      <div ref={containerRef} className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-[17px] -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchQuery}
          disabled={isFull}
          onChange={(event) => {
            setSearchQuery(event.target.value);
            setDismissed(false);
          }}
          onFocus={() => setDismissed(false)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setDismissed(true);
          }}
          placeholder={isFull ? "All slots used" : "Search CurseForge..."}
          className="h-[46px] rounded-[10px] bg-white/[0.03] pl-10 text-sm"
        />
        {dropdownOpen && (
          <div className="absolute inset-x-0 top-[calc(100%+8px)] z-50 flex max-h-[420px] flex-col gap-0.5 overflow-y-auto rounded-xl border border-border bg-popover p-1.5 shadow-[0_12px_32px_rgb(0_0_0/0.45)]">
            {searchResults.isLoading && (
              <p className="px-4 py-7 text-center text-[13px] text-muted-foreground">
                Searching...
              </p>
            )}
            {searchResults.error && (
              <p className="px-4 py-7 text-center text-[13px] text-destructive">
                Search failed. Try again in a moment.
              </p>
            )}
            {searchResults.data?.map((result) => {
              const state = resultState(result);
              const noteOpen = noteFor === result.id;
              const suggesting =
                suggestMutation.isPending &&
                suggestMutation.variables?.projectId === result.id;
              const meta = [
                result.primaryAuthor && `by ${result.primaryAuthor}`,
                `${formatDownloads(result.downloadCount)} downloads`,
                result.summary,
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <div
                  key={result.id}
                  className="rounded-[10px] transition-colors hover:bg-white/[0.04]"
                >
                  <div className="flex items-center gap-3.5 px-3 py-2.5">
                    <ProjectThumb
                      name={result.name}
                      thumbnailUrl={result.thumbnailUrl}
                      className="size-10 rounded-[9px] text-xs"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">
                        {result.name}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {meta}
                      </div>
                    </div>
                    {state ? (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {state}
                      </span>
                    ) : (
                      !noteOpen && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0"
                          disabled={suggestMutation.isPending}
                          onClick={() => {
                            setNoteFor(result.id);
                            setNote("");
                          }}
                        >
                          Suggest
                        </Button>
                      )
                    )}
                  </div>
                  {noteOpen && (
                    <div className="flex flex-col gap-2 border-t border-border p-3">
                      <div className="flex items-center gap-2">
                        <Input
                          autoFocus
                          value={note}
                          maxLength={500}
                          onChange={(event) => setNote(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              confirmSuggest(result.id);
                            }
                            if (event.key === "Escape") {
                              setNoteFor(null);
                              setNote("");
                            }
                          }}
                          placeholder="Why this one? What does it add to the pack?"
                          className="h-9 flex-1 rounded-lg text-[13px]"
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
                          aria-label="Cancel"
                          onClick={() => {
                            setNoteFor(null);
                            setNote("");
                          }}
                        >
                          <X className="size-3.5" />
                        </Button>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {noteReady
                          ? "Press Enter to submit."
                          : "At least 10 characters."}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
            {!searchResults.isLoading && searchResults.data?.length === 0 && (
              <p className="px-4 py-7 text-center text-[13px] text-muted-foreground">
                No compatible mods found.
              </p>
            )}
          </div>
        )}
      </div>

      {isFull && (
        <div className="flex items-center gap-2.5 rounded-[10px] border border-primary/35 bg-primary/[0.06] px-4 py-3 text-[13px]">
          <Info className="size-4 shrink-0 text-primary" />
          All {workshop.maxModsPerUser} slots used — remove a suggestion to add
          another.
        </div>
      )}
    </section>
  );
}
