import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loading } from "@/components/loading-spinner";
import { trpc } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";
import {
  Plus,
  Package,
  Search,
  Filter,
  Upload,
  MoreHorizontal,
  Eye,
  Copy,
  CheckCircle2,
  XCircle,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type StatusFilter = "all" | "enabled" | "disabled";
type ActiveFilter = "all" | "active" | "inactive";

/** Admin page for managing structure packs and their weekly rotation schedule */
export function AdminStructurePacks() {
  const navigate = useNavigate();
  const toast = useToastActions();
  const utils = trpc.useUtils();

  const packsQuery = trpc.admin.structurePacks.list.useQuery();
  const packs = useMemo(() => packsQuery.data ?? [], [packsQuery.data]);

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");

  const [deleteTarget, setDeleteTarget] = useState<{
    id: number;
    name: string;
  } | null>(null);

  const filteredPacks = useMemo(() => {
    let result = packs;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q),
      );
    }

    if (statusFilter !== "all") {
      result = result.filter((p) =>
        statusFilter === "enabled" ? p.enabled : !p.enabled,
      );
    }

    if (activeFilter !== "all") {
      result = result.filter((p) =>
        activeFilter === "active" ? p.isActive : !p.isActive,
      );
    }

    return result;
  }, [packs, searchQuery, statusFilter, activeFilter]);

  const importMutation = trpc.admin.structurePacks.importPacks.useMutation({
    onSuccess: (result) => {
      const parts: string[] = [];
      if (result.created.length > 0)
        parts.push(`Created: ${result.created.join(", ")}`);
      if (result.skipped.length > 0)
        parts.push(`Skipped (already exist): ${result.skipped.join(", ")}`);
      toast.success(parts.join(". ") || "Nothing to import");
      utils.admin.structurePacks.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  function copyPackJson(pack: (typeof packs)[number]) {
    const exported = {
      structurePacks: [
        {
          name: pack.name,
          description: pack.description,
          enabled: pack.enabled,
          mods: pack.mods.map((m) => ({
            curseforgeModId: m.curseforgeModId,
            curseforgeFileId: m.curseforgeFileId,
            fileName: m.fileName,
            modName: m.modName,
            modUrl: m.modUrl,
            thumbnailUrl: m.thumbnailUrl,
          })),
        },
      ],
    };
    navigator.clipboard.writeText(JSON.stringify(exported, null, 2));
    toast.success(`Copied "${pack.name}" to clipboard`);
  }

  async function handleImport() {
    try {
      const text = await navigator.clipboard.readText();
      const data = JSON.parse(text);
      importMutation.mutate(data);
    } catch {
      toast.error("Could not read clipboard or invalid JSON");
    }
  }

  const createMutation = trpc.admin.structurePacks.create.useMutation({
    onSuccess: (pack) => {
      toast.success("Structure pack created");
      utils.admin.structurePacks.list.invalidate();
      setCreateOpen(false);
      setName("");
      setDescription("");
      navigate(`/admin/tools/structure-packs/${pack.id}`);
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleEnabledMutation =
    trpc.admin.structurePacks.toggleEnabled.useMutation({
      onSuccess: (_data, variables) => {
        toast.success(variables.enabled ? "Pack enabled" : "Pack disabled");
        utils.admin.structurePacks.list.invalidate();
      },
      onError: (err) => toast.error(err.message),
    });

  const deleteMutation = trpc.admin.structurePacks.delete.useMutation({
    onSuccess: () => {
      toast.success("Pack deleted");
      utils.admin.structurePacks.list.invalidate();
      setDeleteTarget(null);
    },
    onError: (err) => toast.error(err.message),
  });

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
              <BreadcrumbPage>Structure Packs</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <div className="mx-auto w-full max-w-[1400px] flex flex-1 flex-col gap-4 px-4 pb-4">
        <h1 className="text-2xl font-semibold">Structure Packs</h1>

        {/* Rotation Settings & History */}
        <div className="grid gap-4 lg:grid-cols-2">
          <RotationConfig />
          <RotationHistory />
        </div>

        {/* Filters */}
        <Card className="gap-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Filter className="size-4 text-muted-foreground" />
                Packs
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleImport}
                  disabled={importMutation.isPending}
                >
                  <Upload className="mr-2 size-4" />
                  Import
                </Button>
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus className="mr-2 size-4" />
                  New Pack
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <div className="relative min-w-48 flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as StatusFilter)}
              >
                <SelectTrigger className="min-w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="enabled">Enabled</SelectItem>
                  <SelectItem value="disabled">Disabled</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={activeFilter}
                onValueChange={(v) => setActiveFilter(v as ActiveFilter)}
              >
                <SelectTrigger className="min-w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Packs</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Packs Table */}
        <Card className="gap-0">
          <CardHeader className="gap-0 border-b">
            <CardTitle>
              Packs ({filteredPacks.length.toLocaleString()})
            </CardTitle>
          </CardHeader>

          {packsQuery.isLoading ? (
            <CardContent className="flex flex-1 items-center justify-center py-12">
              <Loading size="medium" text="Loading structure packs..." />
            </CardContent>
          ) : filteredPacks.length === 0 ? (
            <CardContent className="flex flex-1 items-center justify-center py-12">
              <div className="text-center">
                <Package className="mx-auto size-12 text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">
                  {packs.length === 0
                    ? "No structure packs yet"
                    : "No packs match your filters"}
                </p>
                {packs.length === 0 && (
                  <Button onClick={() => setCreateOpen(true)} className="mt-4">
                    <Plus className="mr-2 size-4" />
                    Create First Pack
                  </Button>
                )}
              </div>
            </CardContent>
          ) : (
            <CardContent className="px-0">
              <Table>
                <TableHeader className="bg-sidebar-accent/50">
                  <TableRow>
                    <TableHead className="px-4">Name</TableHead>
                    <TableHead className="px-4">Status</TableHead>
                    <TableHead className="px-4">Mods</TableHead>
                    <TableHead className="px-4">Last Active</TableHead>
                    <TableHead className="px-4 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPacks.map((pack) => (
                    <TableRow key={pack.id}>
                      <TableCell className="px-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{pack.name}</p>
                            {pack.isActive && (
                              <Badge className="bg-green-500/20 text-green-500 hover:bg-green-500/30">
                                Active
                              </Badge>
                            )}
                          </div>
                          {pack.description && (
                            <p className="mt-0.5 max-w-[300px] truncate text-xs text-muted-foreground">
                              {pack.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-4">
                        <Badge
                          variant="outline"
                          className={
                            pack.enabled
                              ? "border-success bg-success/10 text-success"
                              : "border-muted-foreground bg-muted-foreground/10 text-muted-foreground"
                          }
                        >
                          {pack.enabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 text-sm">
                        {pack.mods.length} mod
                        {pack.mods.length !== 1 && "s"}
                      </TableCell>
                      <TableCell className="px-4 text-sm text-muted-foreground">
                        {pack.lastActivatedAt
                          ? new Date(pack.lastActivatedAt).toLocaleDateString()
                          : "Never"}
                      </TableCell>
                      <TableCell className="px-4 text-right">
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="size-8 p-0"
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() =>
                                navigate(
                                  `/admin/tools/structure-packs/${pack.id}`,
                                )
                              }
                            >
                              <Eye className="mr-2 size-4" />
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => copyPackJson(pack)}
                            >
                              <Copy className="mr-2 size-4" />
                              Copy
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              disabled={
                                pack.isActive || toggleEnabledMutation.isPending
                              }
                              onClick={() =>
                                toggleEnabledMutation.mutate({
                                  id: pack.id,
                                  enabled: !pack.enabled,
                                })
                              }
                            >
                              {pack.enabled ? (
                                <>
                                  <XCircle className="mr-2 size-4" />
                                  Disable
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="mr-2 size-4" />
                                  Enable
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              disabled={pack.isActive}
                              onClick={() =>
                                setDeleteTarget({
                                  id: pack.id,
                                  name: pack.name,
                                })
                              }
                            >
                              <Trash2 className="mr-2 size-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          )}
        </Card>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete &quot;{deleteTarget?.name}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the pack from the rotation pool. Historical data
              will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (deleteTarget) {
                  deleteMutation.mutate({ id: deleteTarget.id });
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Structure Pack</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Medieval Structures"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A collection of medieval-themed structure mods"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                createMutation.mutate({
                  name,
                  description: description || undefined,
                })
              }
              disabled={!name.trim() || createMutation.isPending}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
