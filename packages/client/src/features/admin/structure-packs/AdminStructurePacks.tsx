import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loading } from "@/components/loading-spinner";
import { trpc } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";
import { Plus, Package, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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

export function AdminStructurePacks() {
  const navigate = useNavigate();
  const toast = useToastActions();
  const utils = trpc.useUtils();

  const packsQuery = trpc.admin.structurePacks.list.useQuery();
  const packs = packsQuery.data ?? [];

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

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

      <div className="flex flex-1 flex-col gap-4 px-4 pb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Structure Packs</h1>
          <Button
            onClick={() => setCreateOpen(true)}
            className="cursor-pointer"
          >
            <Plus className="mr-2 size-4" />
            New Pack
          </Button>
        </div>

        {packsQuery.isLoading ? (
          <div className="flex flex-1 items-center justify-center py-12">
            <Loading size="medium" text="Loading structure packs..." />
          </div>
        ) : packs.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-12">
            <div className="text-center">
              <Package className="mx-auto size-12 text-muted-foreground" />
              <p className="mt-2 text-muted-foreground">
                No structure packs yet
              </p>
              <Button
                onClick={() => setCreateOpen(true)}
                className="mt-4 cursor-pointer"
              >
                <Plus className="mr-2 size-4" />
                Create First Pack
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {packs.map((pack) => (
              <div
                key={pack.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-sidebar-accent/30"
                onClick={() =>
                  navigate(`/admin/tools/structure-packs/${pack.id}`)
                }
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-semibold">{pack.name}</h3>
                    {pack.isActive && (
                      <Badge className="bg-green-500/20 text-green-500 hover:bg-green-500/30">
                        Active
                      </Badge>
                    )}
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
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                    {pack.description && (
                      <span className="truncate">{pack.description}</span>
                    )}
                    <span>
                      {pack.mods.length} mod{pack.mods.length !== 1 && "s"}
                    </span>
                    {pack.lastActivatedAt && (
                      <span>
                        Last active:{" "}
                        {new Date(pack.lastActivatedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </div>
            ))}
          </div>
        )}
      </div>

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
            <Button
              variant="outline"
              className="cursor-pointer"
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="cursor-pointer"
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
