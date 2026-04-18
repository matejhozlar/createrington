import { useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useToastActions } from "@/hooks/use-toast";
import { trpc } from "@/lib/trpc";

interface PackMod {
  curseforgeModId: number;
}

interface SelectedFile {
  id: number;
  fileName: string;
  displayName: string;
  dependencies: Array<{ modId: number; relationType: number }>;
}

export function AddModDialog({
  open,
  onOpenChange,
  packId,
  packMods,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  packId: number;
  packMods: PackMod[];
}) {
  const toast = useToastActions();
  const utils = trpc.useUtils();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModId, setSelectedModId] = useState<number | null>(null);
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [depOverrides, setDepOverrides] = useState<Set<number> | null>(null);
  const [addingBatch, setAddingBatch] = useState(false);

  const debouncedSearch = useDebouncedValue(searchQuery, 400);

  const searchModsQuery = trpc.admin.structurePacks.searchMods.useQuery(
    { query: debouncedSearch },
    { enabled: debouncedSearch.length >= 2 },
  );

  const modFilesQuery = trpc.admin.structurePacks.getModFiles.useQuery(
    { modId: selectedModId! },
    { enabled: selectedModId !== null },
  );

  const addDepModIds = useMemo(
    () => (selectedFile?.dependencies ?? []).map((d) => d.modId),
    [selectedFile],
  );
  const depsQuery = trpc.admin.structurePacks.resolveDeps.useQuery(
    { packId, modIds: addDepModIds },
    { enabled: addDepModIds.length > 0 && selectedFile !== null },
  );

  // Default selection: required deps not yet in pack
  const defaultDepSelection = useMemo(() => {
    if (!depsQuery.data || !selectedFile) return new Set<number>();
    const set = new Set<number>();
    for (const dep of depsQuery.data) {
      const rel = selectedFile.dependencies.find((d) => d.modId === dep.modId);
      // relationType 3 = Required in the CurseForge API
      if (rel?.relationType === 3 && !dep.inPack && dep.bestFile) {
        set.add(dep.modId);
      }
    }
    return set;
  }, [depsQuery.data, selectedFile]);

  const selectedDeps = depOverrides ?? defaultDepSelection;

  const addModMutation = trpc.admin.structurePacks.addMod.useMutation({
    onSuccess: () => {
      utils.admin.structurePacks.get.invalidate({ id: packId });
      utils.admin.structurePacks.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleDialogOpenChange = (next: boolean) => {
    if (!next) {
      setSearchQuery("");
      setSelectedModId(null);
      setSelectedFile(null);
      setDepOverrides(null);
    }
    onOpenChange(next);
  };

  /**
   * Adds the selected mod and any checked dependencies to the pack in sequence.
   *
   * The primary mod is added first, then each selected dependency is added
   * individually. Failures on individual deps are swallowed so the remaining
   * mods still get added.
   */
  const handleBatchAdd = async () => {
    if (!selectedFile || !selectedModId) return;
    setAddingBatch(true);
    try {
      const searchMod = searchModsQuery.data?.find(
        (m) => m.id === selectedModId,
      );

      await addModMutation.mutateAsync({
        packId,
        curseforgeModId: selectedModId,
        curseforgeFileId: selectedFile.id,
        fileName: selectedFile.fileName,
        modName: searchMod?.name ?? selectedFile.displayName,
        modUrl: searchMod?.url,
        thumbnailUrl: searchMod?.thumbnailUrl,
      });

      for (const depModId of selectedDeps) {
        const dep = depsQuery.data?.find((d) => d.modId === depModId);
        if (!dep?.bestFile) continue;
        try {
          await addModMutation.mutateAsync({
            packId,
            curseforgeModId: dep.modId,
            curseforgeFileId: dep.bestFile.id,
            fileName: dep.bestFile.fileName,
            modName: dep.modName,
            modUrl: dep.modUrl,
            thumbnailUrl: dep.thumbnailUrl,
          });
        } catch {
          // Continue adding remaining deps even if one fails
        }
      }

      const count = 1 + selectedDeps.size;
      toast.success(`Added ${count} mod${count !== 1 ? "s" : ""} to pack`);
      setSelectedFile(null);
      setSelectedModId(null);
      setDepOverrides(null);
      onOpenChange(false);
    } finally {
      setAddingBatch(false);
    }
  };

  return (
    <>
      {/* Search & File Picker */}
      <Dialog
        open={open && selectedFile === null}
        onOpenChange={handleDialogOpenChange}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Mod from CurseForge</DialogTitle>
          </DialogHeader>

          {selectedModId === null ? (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search CurseForge mods..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {searchModsQuery.data && searchModsQuery.data.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {searchModsQuery.data.length} result
                  {searchModsQuery.data.length !== 1 && "s"}
                </p>
              )}

              <div className="max-h-[400px] space-y-2 overflow-y-auto">
                {searchModsQuery.isLoading && (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    Searching...
                  </p>
                )}
                {searchModsQuery.data?.map((mod) => {
                  const alreadyAdded = packMods.some(
                    (m) => m.curseforgeModId === mod.id,
                  );
                  return (
                    <div
                      key={mod.id}
                      className={`flex items-center gap-3 rounded-md border p-3 ${
                        alreadyAdded
                          ? "opacity-50"
                          : "cursor-pointer hover:bg-accent/50"
                      }`}
                      onClick={() => !alreadyAdded && setSelectedModId(mod.id)}
                    >
                      {mod.thumbnailUrl && (
                        <img
                          src={mod.thumbnailUrl}
                          alt=""
                          className="size-10 rounded"
                        />
                      )}
                      <div className="flex-1">
                        <div className="font-medium">{mod.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {mod.slug}
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        {mod.inModpack && (
                          <Badge className="bg-primary/20 text-xs text-primary">
                            In modpack
                          </Badge>
                        )}
                        {alreadyAdded && (
                          <Badge variant="secondary">In pack</Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
                {debouncedSearch.length >= 2 &&
                  !searchModsQuery.isLoading &&
                  searchModsQuery.data?.length === 0 && (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      No mods found
                    </p>
                  )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedModId(null)}
              >
                <ArrowLeft className="mr-1 size-3" />
                Back to search
              </Button>

              <div>
                <h3 className="mb-2 font-medium">Select a file version</h3>
                <div className="max-h-[400px] space-y-2 overflow-y-auto">
                  {modFilesQuery.isLoading && (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      Loading files...
                    </p>
                  )}
                  {modFilesQuery.data?.map((file) => (
                    <div
                      key={file.id}
                      className="flex cursor-pointer items-center justify-between rounded-md border p-3 hover:bg-accent/50"
                      onClick={() => {
                        setSelectedFile({
                          id: file.id,
                          fileName: file.fileName,
                          displayName: file.displayName,
                          dependencies: file.dependencies,
                        });
                        setDepOverrides(null);
                      }}
                    >
                      <div>
                        <div className="font-medium">{file.displayName}</div>
                        <div className="text-xs text-muted-foreground">
                          {file.fileName} ({(file.fileLength / 1024).toFixed(0)}{" "}
                          KB)
                        </div>
                        <div className="mt-1 flex gap-1">
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              file.releaseType === 1
                                ? "border-green-500/50 text-green-500"
                                : file.releaseType === 2
                                  ? "border-yellow-500/50 text-yellow-500"
                                  : "border-red-500/50 text-red-500"
                            }`}
                          >
                            {file.releaseType === 1
                              ? "Release"
                              : file.releaseType === 2
                                ? "Beta"
                                : "Alpha"}
                          </Badge>
                          {file.gameVersions.slice(0, 3).map((v) => (
                            <Badge
                              key={v}
                              variant="outline"
                              className="text-xs"
                            >
                              {v}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                  {modFilesQuery.data?.length === 0 && (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      No compatible files found
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dependency Dialog (sandbox-style) */}
      <Dialog
        open={selectedFile !== null}
        onOpenChange={(next) => {
          if (!next && !addingBatch) {
            setSelectedFile(null);
            setDepOverrides(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dependencies</DialogTitle>
            <DialogDescription>
              <span className="font-medium text-foreground">
                {selectedFile?.displayName}
              </span>{" "}
              {addDepModIds.length > 0
                ? "has dependencies that may need to be added."
                : "has no additional dependencies."}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-80 space-y-2 overflow-y-auto">
            {depsQuery.isLoading && addDepModIds.length > 0 && (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                <Loader2 className="mr-2 size-4 animate-spin" />
                Resolving dependencies...
              </div>
            )}

            {addDepModIds.length === 0 && (
              <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
                No dependencies required.
              </div>
            )}

            {depsQuery.data?.map((dep) => {
              const relType = selectedFile?.dependencies.find(
                (d) => d.modId === dep.modId,
              )?.relationType;
              // relationType 3 = Required in the CurseForge API
              const isRequired = relType === 3;
              const isSelected = selectedDeps.has(dep.modId);
              const canSelect = !dep.inPack && !!dep.bestFile;

              return (
                <div
                  key={dep.modId}
                  className={`flex items-center gap-3 rounded-md border p-3 text-sm${canSelect ? " hover:bg-accent" : ""}`}
                >
                  <div className="shrink-0">
                    {dep.inPack ? (
                      <CheckCircle2 className="size-4 text-green-600" />
                    ) : canSelect ? (
                      <Checkbox
                        checked={isSelected}
                        disabled={addingBatch}
                        onCheckedChange={() =>
                          setDepOverrides((prev) => {
                            const current = prev ?? defaultDepSelection;
                            const next = new Set(current);
                            if (next.has(dep.modId)) next.delete(dep.modId);
                            else next.add(dep.modId);
                            return next;
                          })
                        }
                      />
                    ) : (
                      <div className="size-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 font-medium">
                      <span className="truncate">{dep.modName}</span>
                      <Badge
                        variant={isRequired ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {isRequired ? "Required" : "Optional"}
                      </Badge>
                      {dep.inPack && (
                        <Badge className="bg-green-600 text-xs">In pack</Badge>
                      )}
                    </div>
                    {dep.bestFile ? (
                      <div className="truncate text-xs text-muted-foreground">
                        {dep.bestFile.fileName}
                      </div>
                    ) : !dep.inPack ? (
                      <div className="text-xs text-destructive">
                        No compatible file found
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          <DialogFooter>
            <Button
              onClick={handleBatchAdd}
              disabled={depsQuery.isLoading || addingBatch}
            >
              {addingBatch ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Plus className="size-3.5" />
              )}
              Add{selectedDeps.size > 0 ? ` ${1 + selectedDeps.size} mods` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
