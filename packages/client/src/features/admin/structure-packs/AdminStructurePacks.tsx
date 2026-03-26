import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loading } from "@/components/loading-spinner";
import { trpc } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";
import {
  Blocks,
  Plus,
  Package,
  RotateCw,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
      {/* Header */}
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
        {packsQuery.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loading size="medium" text="Loading structure packs..." />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Blocks className="size-5" />
                <h1 className="text-xl font-semibold">Structure Packs</h1>
                <Badge variant="secondary">{packs.length}</Badge>
              </div>
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-1 size-4" />
                New Pack
              </Button>
            </div>

            {packs.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Package className="mb-4 size-12 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    No structure packs yet. Create one to get started.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {packs.map((pack) => (
                  <Card
                    key={pack.id}
                    className="cursor-pointer transition-colors hover:bg-accent/50"
                    onClick={() =>
                      navigate(`/admin/tools/structure-packs/${pack.id}`)
                    }
                  >
                    <CardContent className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold">{pack.name}</p>
                        <div className="flex gap-1">
                          {pack.isActive && (
                            <Badge className="bg-green-500/20 text-green-500 hover:bg-green-500/30">
                              <CheckCircle2 className="mr-1 size-3" />
                              Active
                            </Badge>
                          )}
                          {pack.enabled && !pack.isActive && (
                            <Badge variant="secondary">
                              <RotateCw className="mr-1 size-3" />
                              In Pool
                            </Badge>
                          )}
                          {!pack.enabled && (
                            <Badge
                              variant="outline"
                              className="text-muted-foreground"
                            >
                              <XCircle className="mr-1 size-3" />
                              Disabled
                            </Badge>
                          )}
                        </div>
                      </div>
                      {pack.description && (
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {pack.description}
                        </p>
                      )}
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>{pack.mods.length} mod(s)</span>
                        {pack.lastActivatedAt && (
                          <span>
                            Last active:{" "}
                            {new Date(
                              pack.lastActivatedAt,
                            ).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
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
              onClick={() => setCreateOpen(false)}
            >
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
