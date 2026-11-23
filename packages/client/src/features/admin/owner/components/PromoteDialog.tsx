import { ADMIN_REASON_MAX_LENGTH } from "@createrington/shared/admin-reason";
import { FormDialog } from "@/components/form-dialog";
import { SearchInput } from "@/components/search-input";
import { Field, FieldLabel } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import { MinecraftAvatar } from "@/components/minecraft-avatar";
import { trpc, queryClient } from "@/lib/trpc";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";
import { useDialogDraft } from "@/hooks/use-dialog-draft";
import type {
  AdminCandidate,
  PromoteResult,
} from "@/features/admin/owner/types";

interface PromoteDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (result: PromoteResult) => void;
}

export function PromoteDialog({
  open,
  onClose,
  onSuccess,
}: PromoteDialogProps) {
  const [draft, update] = useDialogDraft<{
    query: string;
    reason: string;
    selected: AdminCandidate | null;
  }>(open, () => ({ query: "", reason: "", selected: null }));
  const { query, reason, selected } = draft;

  const debouncedQuery = useDebouncedValue(query);
  const searchQuery = useQuery(
    trpc.owner.admins.searchPlayers.queryOptions(
      { query: debouncedQuery },
      { enabled: debouncedQuery.length > 0 && !selected },
    ),
  );

  const promoteMutation = useMutation(
    trpc.owner.admins.promote.mutationOptions(
      useMutationToast({
        onSuccess: (result) => {
          void queryClient.invalidateQueries(trpc.owner.admins.pathFilter());
          onSuccess({
            discordRoleAdded: result.discordRoleAdded,
            minecraftUsername:
              result.minecraftUsername ?? selected?.minecraftUsername ?? null,
          });
        },
      }),
    ),
  );

  const handlePromote = () => {
    if (!selected) return;
    promoteMutation.mutate({
      discordId: selected.discordId,
      reason: reason.trim() || undefined,
    });
  };

  const results = searchQuery.data?.players ?? [];

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <UserPlus className="size-5" />
          Promote to admin
        </span>
      }
      description="Writes an entry to the DB admin table and adds the Discord ADMIN role. Minecraft OP is not granted — you do that manually per trust."
      confirmLabel="Promote"
      onConfirm={handlePromote}
      disabled={!selected}
      loading={promoteMutation.isPending}
      contentClassName="sm:max-w-lg"
    >
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
              onClick={() => update({ selected: null })}
            >
              Change
            </Button>
          </div>
        ) : (
          <div>
            <SearchInput
              value={query}
              onValueChange={(value: string) => update({ query: value })}
              placeholder="Search by Minecraft username or Discord ID"
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
                      onClick={() => update({ selected: p })}
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
        <Textarea
          id="promote-reason"
          value={reason}
          onChange={(e) => update({ reason: e.target.value })}
          placeholder="e.g. Trusted moderator, handles Discord tickets"
          maxLength={ADMIN_REASON_MAX_LENGTH}
          rows={3}
        />
      </Field>
    </FormDialog>
  );
}
