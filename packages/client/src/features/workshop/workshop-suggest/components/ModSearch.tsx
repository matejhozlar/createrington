import { useEffect, useRef, useState } from "react";
import { Info } from "lucide-react";
import { trpc, type RouterOutput, queryClient } from "@/lib/trpc";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import { SearchInput } from "@/components/search-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ClearButton } from "../../components/ClearButton";
import { ProjectThumb } from "../../components/ProjectThumb";
import { formatDownloads } from "../../format";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Spinner } from "@/components/ui/spinner";

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
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [dismissed, setDismissed] = useState(false);
  const [noteFor, setNoteFor] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery.trim(), 400);

  const cancelNote = () => {
    setNoteFor(null);
    setNote("");
  };

  const usedSlots = suggestions.filter((m) => m.status === "pending").length;
  const isFull = usedSlots >= workshop.maxModsPerUser;
  const ownProjectIds = new Set(suggestions.map((m) => m.curseforgeProjectId));
  const searching = !isFull && debouncedSearch.length >= 2;
  const dropdownOpen = searching && !dismissed;

  const searchResults = useQuery(
    trpc.user.workshops.searchProjects.queryOptions(
      { workshopId: workshop.id, query: debouncedSearch },
      { enabled: searching },
    ),
  );

  useEffect(() => {
    if (!dropdownOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setDismissed(true);
        cancelNote();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [dropdownOpen]);

  const suggestMutation = useMutation(
    trpc.user.workshops.suggestMod.mutationOptions(
      useMutationToast({
        success: (mod) => `"${mod.project.name}" suggested, awaiting review`,
        onSuccess: () => {
          setNoteFor(null);
          setNote("");
          void queryClient.invalidateQueries(
            trpc.user.workshops.mySuggestions.queryFilter({
              workshopId: workshop.id,
            }),
          );
          void queryClient.invalidateQueries(
            trpc.user.workshops.mySuggestionHistory.pathFilter(),
          );
          void queryClient.invalidateQueries(
            trpc.user.workshops.searchProjects.pathFilter(),
          );
          void queryClient.invalidateQueries(
            trpc.user.workshops.get.pathFilter(),
          );
          void queryClient.invalidateQueries(
            trpc.user.workshops.list.pathFilter(),
          );
          void queryClient.invalidateQueries(
            trpc.user.workshops.myUpvotes.queryFilter({
              workshopId: workshop.id,
            }),
          );
        },
      }),
    ),
  );

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
        <h2 className="text-2xl font-semibold">Find a mod</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Search CurseForge by mod name or author.
        </p>
      </div>

      <div ref={containerRef}>
        <SearchInput
          ref={searchInputRef}
          value={searchQuery}
          disabled={isFull}
          onValueChange={(value) => {
            setSearchQuery(value);
            setDismissed(false);
          }}
          onFocus={() => setDismissed(false)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setDismissed(true);
              cancelNote();
            }
          }}
          placeholder={isFull ? "All slots used" : "Search CurseForge..."}
          iconClassName="left-3.5 size-[17px]"
          inputClassName="h-[46px] rounded-[10px] bg-white/[0.03] pr-10 pl-10 text-sm"
        >
          {searchQuery && (
            <ClearButton
              className="right-2"
              inputRef={searchInputRef}
              onClick={() => {
                setSearchQuery("");
                cancelNote();
              }}
            />
          )}
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
                                cancelNote();
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
                              <Spinner className="size-3.5" />
                            ) : (
                              "Suggest"
                            )}
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
        </SearchInput>
      </div>

      {isFull && (
        <div className="flex items-center gap-2.5 rounded-[10px] border border-primary/35 bg-primary/[0.06] px-4 py-3 text-[13px]">
          <Info className="size-4 shrink-0 text-primary" />
          All {workshop.maxModsPerUser} slots used. Remove a suggestion to add
          another.
        </div>
      )}
    </section>
  );
}
