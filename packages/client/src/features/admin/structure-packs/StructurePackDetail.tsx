import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loading } from "@/components/loading-spinner";
import { trpc } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  ArrowLeft,
  Pencil,
  Save,
  Trash2,
  Search,
  Plus,
  Package,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export function StructurePackDetail() {
  const { id } = useParams<{ id: string }>();
  const packId = parseInt(id ?? "0", 10);
  const navigate = useNavigate();
  const toast = useToastActions();
  const utils = trpc.useUtils();

  const packQuery = trpc.admin.structurePacks.get.useQuery(
    { id: packId },
    { enabled: packId > 0 },
  );
  const pack = packQuery.data;

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  // Add mod dialog state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModId, setSelectedModId] = useState<number | null>(null);
  const [selectedFile, setSelectedFile] = useState<{
    id: number;
    fileName: string;
    displayName: string;
    dependencies: Array<{ modId: number; relationType: number }>;
  } | null>(null);
  const [depOverrides, setDepOverrides] = useState<Set<number> | null>(null);

  // Remove mod dialog state
  const [removeDialog, setRemoveDialog] = useState<{
    modId: number;
    modName: string;
    fileName: string;
  } | null>(null);
  const [removeDepOverrides, setRemoveDepOverrides] =
    useState<Set<number> | null>(null);

  const debouncedSearch = useDebouncedValue(searchQuery, 400);

  const searchModsQuery = trpc.admin.structurePacks.searchMods.useQuery(
    { query: debouncedSearch },
    { enabled: debouncedSearch.length >= 2 },
  );

  const modFilesQuery = trpc.admin.structurePacks.getModFiles.useQuery(
    { modId: selectedModId! },
    { enabled: selectedModId !== null },
  );

  // Dep resolution for add flow
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
      if (rel?.relationType === 3 && !dep.inPack && dep.bestFile) {
        set.add(dep.modId);
      }
    }
    return set;
  }, [depsQuery.data, selectedFile]);

  const selectedDeps = depOverrides ?? defaultDepSelection;

  // Dep check for remove flow
  const checkRemoveDepsQuery =
    trpc.admin.structurePacks.checkRemoveDeps.useQuery(
      { packId, modId: removeDialog?.modId ?? 0 },
      { enabled: removeDialog !== null },
    );

  const defaultRemoveSelection = useMemo(() => {
    if (!checkRemoveDepsQuery.data) return new Set<number>();
    const safeIds = checkRemoveDepsQuery.data.deps
      .filter((d) => d.safe)
      .map((d) => d.modId);
    return new Set(safeIds);
  }, [checkRemoveDepsQuery.data]);

  const selectedRemoveDeps = removeDepOverrides ?? defaultRemoveSelection;

  // Mutations
  const updateMutation = trpc.admin.structurePacks.update.useMutation({
    onSuccess: () => {
      toast.success("Pack updated");
      utils.admin.structurePacks.get.invalidate({ id: packId });
      utils.admin.structurePacks.list.invalidate();
      setEditing(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.admin.structurePacks.delete.useMutation({
    onSuccess: () => {
      toast.success("Pack deleted");
      navigate("/admin/tools/structure-packs");
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleEnabledMutation =
    trpc.admin.structurePacks.toggleEnabled.useMutation({
      onSuccess: () => {
        utils.admin.structurePacks.get.invalidate({ id: packId });
        utils.admin.structurePacks.list.invalidate();
      },
      onError: (err) => toast.error(err.message),
    });

  const addModMutation = trpc.admin.structurePacks.addMod.useMutation({
    onSuccess: () => {
      utils.admin.structurePacks.get.invalidate({ id: packId });
    },
    onError: (err) => toast.error(err.message),
  });

  const removeModMutation = trpc.admin.structurePacks.removeMod.useMutation({
    onSuccess: () => {
      utils.admin.structurePacks.get.invalidate({ id: packId });
    },
    onError: (err) => toast.error(err.message),
  });

  // Batch add handler
  const [addingBatch, setAddingBatch] = useState(false);
  const handleBatchAdd = async () => {
    if (!selectedFile || !selectedModId) return;
    setAddingBatch(true);
    try {
      const searchMod = searchModsQuery.data?.find(
        (m) => m.id === selectedModId,
      );

      // Add the main mod
      await addModMutation.mutateAsync({
        packId,
        curseforgeModId: selectedModId,
        curseforgeFileId: selectedFile.id,
        fileName: selectedFile.fileName,
        modName: searchMod?.name ?? selectedFile.displayName,
        modUrl: searchMod?.url,
        thumbnailUrl: searchMod?.thumbnailUrl,
      });

      // Add selected deps
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
    } finally {
      setAddingBatch(false);
    }
  };

  // Batch remove handler
  const [removingBatch, setRemovingBatch] = useState(false);
  const handleBatchRemove = async () => {
    if (!removeDialog) return;
    setRemovingBatch(true);
    try {
      // Remove selected deps first
      for (const depModId of selectedRemoveDeps) {
        const packMod = pack?.mods.find((m) => m.curseforgeModId === depModId);
        if (!packMod) continue;
        try {
          await removeModMutation.mutateAsync({
            packId,
            modId: packMod.id,
          });
        } catch {
          // Continue
        }
      }

      // Remove the target mod
      await removeModMutation.mutateAsync({
        packId,
        modId: removeDialog.modId,
      });

      const count = 1 + selectedRemoveDeps.size;
      toast.success(`Removed ${count} mod${count !== 1 ? "s" : ""} from pack`);
      setRemoveDialog(null);
      setRemoveDepOverrides(null);
    } finally {
      setRemovingBatch(false);
    }
  };

  if (packQuery.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loading size="large" text="Loading pack..." />
      </div>
    );
  }

  if (!pack) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-destructive">Pack not found</p>
      </div>
    );
  }

  const startEditing = () => {
    setEditName(pack.name);
    setEditDescription(pack.description ?? "");
    setEditing(true);
  };

  return (
    <div className="flex flex-1 flex-col gap-4">
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border bg-sidebar px-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin/dashboard">Admin</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin/tools">Tools</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin/tools/structure-packs">
                Structure Packs
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{pack.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <div className="flex flex-1 flex-col gap-4 px-4 pb-4">
        {/* Pack header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{pack.name}</h1>
            {pack.isActive && (
              <Badge className="bg-green-500/20 text-green-500 hover:bg-green-500/30">
                Active
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="enabled"
                checked={pack.enabled}
                disabled={pack.isActive}
                onCheckedChange={(checked) =>
                  toggleEnabledMutation.mutate({
                    id: packId,
                    enabled: checked === true,
                  })
                }
              />
              <Label htmlFor="enabled" className="cursor-pointer text-sm">
                Enabled
              </Label>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="cursor-pointer"
              onClick={startEditing}
            >
              <Pencil className="size-4" />
              Edit
            </Button>
            {!pack.isActive && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="cursor-pointer"
                  >
                    <Trash2 className="size-4" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Delete &quot;{pack.name}&quot;?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove the pack from the rotation pool.
                      Historical data will be preserved.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="cursor-pointer">
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      className="cursor-pointer"
                      onClick={() => deleteMutation.mutate({ id: packId })}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        {pack.description && (
          <p className="text-sm text-muted-foreground">{pack.description}</p>
        )}

        {/* Mods Section */}
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Mods</h2>
              <p className="text-sm text-muted-foreground">
                CurseForge mods included in this pack
              </p>
            </div>
            <Button
              size="sm"
              className="cursor-pointer"
              onClick={() => setSearchOpen(true)}
            >
              <Plus className="size-4" />
              Add Mod
            </Button>
          </div>
          {pack.mods.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Package className="mb-2 size-8" />
              <p>No mods added yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mod</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pack.mods.map((mod) => (
                  <TableRow key={mod.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {mod.thumbnailUrl && (
                          <img
                            src={mod.thumbnailUrl}
                            alt=""
                            className="size-8 rounded"
                          />
                        )}
                        <div>
                          <div className="font-medium">{mod.modName}</div>
                          {mod.modUrl && (
                            <a
                              href={mod.modUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs text-muted-foreground hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              CurseForge
                              <ExternalLink className="size-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {mod.fileName}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="cursor-pointer text-destructive hover:text-destructive"
                        onClick={() =>
                          setRemoveDialog({
                            modId: mod.id,
                            modName: mod.modName,
                            fileName: mod.fileName,
                          })
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Pack</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                updateMutation.mutate({
                  id: packId,
                  name: editName,
                  description: editDescription || undefined,
                })
              }
              disabled={!editName.trim() || updateMutation.isPending}
            >
              <Save className="mr-1 size-3" />
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Mod Dialog — Search & File Picker */}
      <Dialog
        open={searchOpen && selectedFile === null}
        onOpenChange={(open) => {
          if (!open) {
            setSearchOpen(false);
            setSearchQuery("");
            setSelectedModId(null);
          }
        }}
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
                  const alreadyAdded = pack.mods.some(
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
                className="cursor-pointer"
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
        onOpenChange={(open) => {
          if (!open && !addingBatch) {
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
              className="cursor-pointer"
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

      {/* Remove Mod Dialog (sandbox-style) */}
      <Dialog
        open={removeDialog !== null}
        onOpenChange={(open) => {
          if (!open && !removingBatch) {
            setRemoveDialog(null);
            setRemoveDepOverrides(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Mod</DialogTitle>
            <DialogDescription>
              This will remove mod entries from the pack.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-80 space-y-2 overflow-y-auto">
            {/* Target mod — always removed */}
            <div className="flex items-center gap-3 rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm">
              <Trash2 className="size-4 shrink-0 text-destructive" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">
                  {removeDialog?.modName}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {removeDialog?.fileName}
                </div>
              </div>
            </div>

            {/* Dependents warning: other pack mods that need this mod */}
            {checkRemoveDepsQuery.data &&
              checkRemoveDepsQuery.data.dependents.length > 0 && (
                <div className="flex items-start gap-3 rounded-md border border-yellow-500/50 bg-yellow-500/5 p-3 text-sm">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-yellow-500" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-yellow-500">
                      Other mods depend on this
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {checkRemoveDepsQuery.data.dependents
                        .map((d) => d.modName)
                        .join(", ")}
                    </div>
                  </div>
                </div>
              )}

            {checkRemoveDepsQuery.isLoading && (
              <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
                <Loader2 className="mr-2 size-4 animate-spin" />
                Checking dependencies...
              </div>
            )}

            {checkRemoveDepsQuery.data &&
              checkRemoveDepsQuery.data.deps.length === 0 &&
              checkRemoveDepsQuery.data.dependents.length === 0 && (
                <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
                  <CheckCircle2 className="mr-2 size-4 text-green-500" />
                  No dependency conflicts, safe to remove.
                </div>
              )}

            {checkRemoveDepsQuery.data &&
              checkRemoveDepsQuery.data.deps.length === 0 &&
              checkRemoveDepsQuery.data.dependents.length > 0 && (
                <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
                  No removable dependencies.
                </div>
              )}

            {checkRemoveDepsQuery.data?.deps.map((dep) => (
              <div
                key={dep.modId}
                className={`flex items-center gap-3 rounded-md border p-3 text-sm${dep.safe ? " hover:bg-accent" : ""}`}
              >
                <div className="shrink-0">
                  {dep.safe ? (
                    <Checkbox
                      checked={selectedRemoveDeps.has(dep.modId)}
                      disabled={removingBatch}
                      onCheckedChange={() =>
                        setRemoveDepOverrides((prev) => {
                          const current = prev ?? defaultRemoveSelection;
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
                    {dep.safe ? (
                      <Badge variant="secondary" className="text-xs">
                        Unused
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        In use
                      </Badge>
                    )}
                  </div>
                  {!dep.safe && dep.neededBy.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      Needed by {dep.neededBy.join(", ")}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button
              variant="destructive"
              onClick={handleBatchRemove}
              disabled={checkRemoveDepsQuery.isLoading || removingBatch}
              className="cursor-pointer"
            >
              {removingBatch ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
              Remove
              {selectedRemoveDeps.size > 0
                ? ` ${1 + selectedRemoveDeps.size} mods`
                : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
