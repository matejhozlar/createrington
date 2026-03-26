import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loading } from "@/components/loading-spinner";
import { trpc } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Pencil,
  Save,
  Trash2,
  Search,
  Plus,
  X,
  Package,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
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
import { RotationConfig } from "./components/RotationConfig";
import { RotationHistory } from "./components/RotationHistory";

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
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModId, setSelectedModId] = useState<number | null>(null);

  const searchModsQuery = trpc.admin.structurePacks.searchMods.useQuery(
    { query: searchQuery },
    { enabled: searchQuery.length >= 2 },
  );

  const modFilesQuery = trpc.admin.structurePacks.getModFiles.useQuery(
    { modId: selectedModId! },
    { enabled: selectedModId !== null },
  );

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
      toast.success("Mod added");
      utils.admin.structurePacks.get.invalidate({ id: packId });
      setSelectedModId(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const removeModMutation = trpc.admin.structurePacks.removeMod.useMutation({
    onSuccess: () => {
      toast.success("Mod removed");
      utils.admin.structurePacks.get.invalidate({ id: packId });
    },
    onError: (err) => toast.error(err.message),
  });

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
                disabled={pack.isActive || toggleEnabledMutation.isPending}
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
                        className="cursor-pointer"
                        onClick={() =>
                          removeModMutation.mutate({
                            packId,
                            modId: mod.id,
                          })
                        }
                        disabled={removeModMutation.isPending}
                      >
                        <X className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Rotation Config & History */}
        <div className="grid gap-4 lg:grid-cols-2">
          <RotationConfig />
          <RotationHistory />
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

      {/* Add Mod Dialog */}
      <Dialog
        open={searchOpen}
        onOpenChange={(open) => {
          setSearchOpen(open);
          if (!open) {
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
                      {alreadyAdded && (
                        <Badge variant="secondary">Already added</Badge>
                      )}
                    </div>
                  );
                })}
                {searchQuery.length >= 2 &&
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
                  {modFilesQuery.data?.map((file) => {
                    const searchMod = searchModsQuery.data?.find(
                      (m) => m.id === selectedModId,
                    );
                    return (
                      <div
                        key={file.id}
                        className="flex items-center justify-between rounded-md border p-3 hover:bg-accent/50"
                      >
                        <div>
                          <div className="font-medium">{file.displayName}</div>
                          <div className="text-xs text-muted-foreground">
                            {file.fileName} (
                            {(file.fileLength / 1024).toFixed(0)} KB)
                          </div>
                          <div className="mt-1 flex gap-1">
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
                        <Button
                          size="sm"
                          className="cursor-pointer"
                          onClick={() => {
                            addModMutation.mutate({
                              packId,
                              curseforgeModId: selectedModId!,
                              curseforgeFileId: file.id,
                              fileName: file.fileName,
                              modName: searchMod?.name ?? file.displayName,
                              modUrl: searchMod?.url,
                              thumbnailUrl: searchMod?.thumbnailUrl,
                            });
                            setSearchOpen(false);
                            setSearchQuery("");
                            setSelectedModId(null);
                          }}
                          disabled={addModMutation.isPending}
                        >
                          <Plus className="mr-1 size-3" />
                          Add
                        </Button>
                      </div>
                    );
                  })}
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
    </div>
  );
}
