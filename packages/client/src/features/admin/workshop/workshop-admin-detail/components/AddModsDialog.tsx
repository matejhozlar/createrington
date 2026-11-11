import { useState } from "react";
import { Plus, X } from "lucide-react";
import {
  CURSEFORGE_CLASSES,
  curseforgeClassLabelPlural,
  WORKSHOP_ADMIN_EXTRA_CLASSES,
} from "@createrington/shared/workshop";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useToastActions } from "@/hooks/use-toast";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import { Badge } from "@/components/ui/badge";
import { FormDialog } from "@/components/form-dialog";
import { SearchInput } from "@/components/search-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProjectThumb } from "@/features/workshop/components/ProjectThumb";
import {
  MOD_STATUS_STYLES,
  COMPACT_BADGE_CLASS,
  projectKindLabel,
} from "@/features/workshop/format";
import { useQuery, useMutation } from "@tanstack/react-query";

interface SelectedProject {
  id: number;
  name: string;
  thumbnailUrl: string | null;
  classId: number;
}

const MAX_MODS_PER_ADD = 20;

export function AddModsDialog({
  open,
  onOpenChange,
  workshopId,
  workshopClassId,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workshopId: number;
  workshopClassId: number;
  onAdded: () => void;
}) {
  const toast = useToastActions();

  const [selected, setSelected] = useState<SelectedProject[]>([]);
  const [note, setNote] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [classId, setClassId] = useState(workshopClassId);
  const debouncedSearch = useDebouncedValue(searchQuery.trim(), 400);

  const classOptions =
    workshopClassId === CURSEFORGE_CLASSES.mods
      ? [
          workshopClassId,
          ...WORKSHOP_ADMIN_EXTRA_CLASSES.filter((c) => c !== workshopClassId),
        ]
      : [workshopClassId];

  const searchResults = useQuery(
    trpc.admin.workshops.searchProjects.queryOptions(
      { workshopId, query: debouncedSearch, classId },
      { enabled: open && debouncedSearch.length >= 2 },
    ),
  );

  const addMutation = useMutation(
    trpc.admin.workshops.addMods.mutationOptions(
      useMutationToast({
        success: (mods) =>
          `Added ${mods.length} project${mods.length !== 1 ? "s" : ""} as approved`,
        onSuccess: () => {
          onAdded();
          setSelected([]);
          setNote("");
          setSearchQuery("");
          setClassId(workshopClassId);
          onOpenChange(false);
        },
      }),
    ),
  );

  const handleClose = (next: boolean) => {
    if (!next && !addMutation.isPending) {
      setSelected([]);
      setNote("");
      setSearchQuery("");
      setClassId(workshopClassId);
    }
    if (!addMutation.isPending) onOpenChange(next);
  };

  const trimmedNote = note.trim();
  const noteTooShort = trimmedNote.length > 0 && trimmedNote.length < 10;

  return (
    <FormDialog
      open={open}
      onClose={() => handleClose(false)}
      title="Add Projects"
      description="Mods and resource packs added here become suggestions credited to you, already approved. They still go through testing before reaching the pack."
      onConfirm={() =>
        addMutation.mutate({
          workshopId,
          projectIds: selected.map((p) => p.id),
          note: trimmedNote || undefined,
        })
      }
      confirmLabel={`Add ${selected.length > 0 ? `${selected.length} ` : ""}as Approved`}
      disabled={selected.length === 0 || noteTooShort}
      loading={addMutation.isPending}
      contentClassName="max-h-[85vh] overflow-y-auto sm:max-w-lg"
    >
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((project) => {
            const kind = projectKindLabel(project.classId);
            return (
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
                {kind && (
                  <Badge tone="fuchsia" className={COMPACT_BADGE_CLASS}>
                    {kind}
                  </Badge>
                )}
                <button
                  type="button"
                  aria-label={`Remove ${project.name}`}
                  onClick={() =>
                    setSelected((prev) =>
                      prev.filter((p) => p.id !== project.id),
                    )
                  }
                >
                  <X className="size-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}

      {classOptions.length > 1 && (
        <div
          role="group"
          aria-label="Project type"
          className="inline-flex h-9 w-fit items-center justify-center rounded-lg bg-muted p-1"
        >
          {classOptions.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={option === classId}
              onClick={() => setClassId(option)}
              className={cn(
                "inline-flex cursor-pointer items-center justify-center whitespace-nowrap rounded-md px-2.5 py-1 text-sm font-medium text-foreground/80 transition-[color,box-shadow]",
                option === classId && "bg-background text-foreground shadow-sm",
              )}
            >
              {curseforgeClassLabelPlural(option)}
            </button>
          ))}
        </div>
      )}

      <SearchInput
        placeholder="Search CurseForge..."
        value={searchQuery}
        onValueChange={setSearchQuery}
      />

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
              className={cn(
                "flex w-full items-center gap-3 rounded-md border p-2.5 text-left",
                blocked ? "opacity-50" : "cursor-pointer hover:bg-accent/50",
              )}
              onClick={() => {
                if (selected.length >= MAX_MODS_PER_ADD) {
                  toast.error(
                    `You can add up to ${MAX_MODS_PER_ADD} projects at a time`,
                  );
                  return;
                }
                setSelected((prev) => [
                  ...prev,
                  {
                    id: result.id,
                    name: result.name,
                    thumbnailUrl: result.thumbnailUrl ?? null,
                    classId,
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
                    tone={MOD_STATUS_STYLES.rejected.tone}
                    className="text-xs"
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
                    tone={MOD_STATUS_STYLES.in_pack.tone}
                    className="text-xs"
                  >
                    In base pack
                  </Badge>
                )}
                {alreadySelected && (
                  <Badge variant="secondary" className="text-xs">
                    Selected
                  </Badge>
                )}
                {!blocked && <Plus className="size-4 text-muted-foreground" />}
              </div>
            </button>
          );
        })}
        {debouncedSearch.length >= 2 &&
          !searchResults.isLoading &&
          searchResults.data?.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No compatible {curseforgeClassLabelPlural(classId).toLowerCase()}{" "}
              found
            </p>
          )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="add-mods-note">Note (Optional)</Label>
        <Input
          id="add-mods-note"
          placeholder="Why these? Shown to players on every project in this add."
          maxLength={500}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
        {noteTooShort && (
          <p className="text-xs text-destructive">
            Give it at least 10 characters, or leave it empty.
          </p>
        )}
      </div>
    </FormDialog>
  );
}
