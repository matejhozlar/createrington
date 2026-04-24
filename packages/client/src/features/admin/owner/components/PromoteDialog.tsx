import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Search, UserPlus } from "lucide-react";
import { MinecraftAvatar } from "@/components/minecraft-avatar";
import { trpc } from "@/lib/trpc";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useToastActions } from "@/hooks/use-toast";

interface PromoteDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (result: {
    discordRoleAdded: boolean;
    minecraftUsername: string | null;
  }) => void;
}

export function PromoteDialog({
  open,
  onClose,
  onSuccess,
}: PromoteDialogProps) {
  const toast = useToastActions();
  const [query, setQuery] = useState("");
  const [reason, setReason] = useState("");
  const [selected, setSelected] = useState<{
    discordId: string;
    minecraftUsername: string;
    minecraftUuid: string;
  } | null>(null);

  const debouncedQuery = useDebouncedValue(query, 300);
  const searchQuery = trpc.owner.admins.searchPlayers.useQuery(
    { query: debouncedQuery },
    { enabled: debouncedQuery.length > 0 && !selected },
  );

  const promoteMutation = trpc.owner.admins.promote.useMutation();

  const handleClose = () => {
    setQuery("");
    setReason("");
    setSelected(null);
    onClose();
  };

  const handlePromote = async () => {
    if (!selected) return;
    try {
      const result = await promoteMutation.mutateAsync({
        discordId: selected.discordId,
        reason: reason.trim() || undefined,
      });
      onSuccess({
        discordRoleAdded: result.discordRoleAdded,
        minecraftUsername:
          result.minecraftUsername ?? selected.minecraftUsername,
      });
      setQuery("");
      setReason("");
      setSelected(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to promote");
    }
  };

  const results = searchQuery.data?.players ?? [];

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="size-5" />
            Promote to admin
          </DialogTitle>
          <DialogDescription>
            Writes an entry to the DB admin table and adds the Discord ADMIN
            role. Minecraft OP is not granted — you do that manually per trust.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Field>
            <FieldLabel>Player</FieldLabel>
            {selected ? (
              <div className="flex items-center justify-between rounded-md border bg-muted/50 p-2">
                <div className="flex items-center gap-2">
                  <MinecraftAvatar
                    username={selected.minecraftUsername}
                    uuid={selected.minecraftUuid}
                    size={24}
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">
                      {selected.minecraftUsername}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {selected.discordId}
                    </span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelected(null)}
                >
                  Change
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by Minecraft username or Discord ID"
                  className="pl-9"
                  autoFocus
                />
                {debouncedQuery.length > 0 && (
                  <div className="mt-2 max-h-64 overflow-y-auto rounded-md border">
                    {searchQuery.isLoading ? (
                      <div className="p-3 text-center text-sm text-muted-foreground">
                        Searching…
                      </div>
                    ) : results.length === 0 ? (
                      <div className="p-3 text-center text-sm text-muted-foreground">
                        No matching non-admin players.
                      </div>
                    ) : (
                      results.map((p) => (
                        <button
                          key={p.discordId}
                          type="button"
                          onClick={() =>
                            setSelected({
                              discordId: p.discordId,
                              minecraftUsername: p.minecraftUsername,
                              minecraftUuid: p.minecraftUuid,
                            })
                          }
                          className="flex w-full items-center gap-2 border-b px-3 py-2 text-left last:border-b-0 hover:bg-muted/50"
                        >
                          <MinecraftAvatar
                            username={p.minecraftUsername}
                            uuid={p.minecraftUuid}
                            size={24}
                          />
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">
                              {p.minecraftUsername}
                            </span>
                            <span className="font-mono text-xs text-muted-foreground">
                              {p.discordId}
                            </span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </Field>

          <Field>
            <FieldLabel htmlFor="promote-reason">Reason (optional)</FieldLabel>
            <textarea
              id="promote-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Trusted moderator, handles Discord tickets"
              maxLength={500}
              rows={3}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handlePromote}
            disabled={!selected || promoteMutation.isPending}
          >
            {promoteMutation.isPending ? "Promoting…" : "Promote"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
