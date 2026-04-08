import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, Blocks } from "lucide-react";

export function ActivePack() {
  const { user } = useAuth();

  const { data: activePack, isLoading } =
    trpc.user.structurePacks.current.useQuery(undefined, {
      enabled: !!user,
    });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-4 w-full mb-3" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-24" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!activePack) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Package className="mx-auto mb-2 size-8 opacity-50" />
          <p>No structure pack is currently active.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/30 bg-primary/[0.03]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">
            {activePack.name}
          </CardTitle>
          <Badge variant="default" className="text-xs">
            Currently Active
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {activePack.description && (
          <p className="text-sm text-muted-foreground">
            {activePack.description}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {activePack.mods.map((mod) => (
            <div
              key={mod.id}
              className="flex items-center gap-1.5 rounded-md border bg-background/50 px-2.5 py-1.5 text-xs"
            >
              {mod.thumbnailUrl ? (
                <img
                  src={mod.thumbnailUrl}
                  alt=""
                  className="size-4 rounded-sm object-cover"
                />
              ) : (
                <Blocks className="size-3.5 text-muted-foreground" />
              )}
              <span>{mod.modName}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
