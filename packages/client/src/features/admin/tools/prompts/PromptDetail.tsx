import { useState } from "react";
import { useParams, useNavigate, NavLink } from "react-router";
import { Loading } from "@/components/loading-spinner";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Lock, RefreshCw, Trash2 } from "lucide-react";
import { mcHeadsAvatar } from "@/lib/external-urls";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";
import { describeEntryRules } from "./format";
import { DeletePromptModal } from "./components/DeletePromptModal";

type ResponseRow = RouterOutput["admin"]["prompts"]["get"]["responses"][number];

interface ResponderGroup {
  discordId: string;
  minecraftUuid: string | null;
  minecraftUsername: string | null;
  entries: ResponseRow[];
}

function formatTime(date: Date | string): string {
  return new Date(date).toLocaleString();
}

// The list is ordered by the newer of submitted/updated, so an edited answer
// sorts to the top; label it with the edit time rather than the original
// submission it would otherwise contradict.
function formatEntryTime(entry: ResponseRow): string {
  const submitted = new Date(entry.submittedAt).getTime();
  const updated = new Date(entry.updatedAt).getTime();
  return updated > submitted
    ? `edited ${formatTime(entry.updatedAt)}`
    : formatTime(entry.submittedAt);
}

function groupByResponder(responses: ResponseRow[]): ResponderGroup[] {
  const groups = new Map<string, ResponderGroup>();
  for (const response of responses) {
    const existing = groups.get(response.discordId);
    if (existing) {
      existing.entries.push(response);
      continue;
    }
    groups.set(response.discordId, {
      discordId: response.discordId,
      minecraftUuid: response.minecraftUuid,
      minecraftUsername: response.minecraftUsername,
      entries: [response],
    });
  }
  for (const group of groups.values()) {
    group.entries.sort((a, b) => a.entryNumber - b.entryNumber);
  }
  return [...groups.values()];
}

export function PromptDetail() {
  const { id } = useParams<{ id: string }>();
  const promptId = id ? parseInt(id, 10) : NaN;
  const toast = useToastActions();
  const navigate = useNavigate();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const detailQuery = trpc.admin.prompts.get.useQuery(
    { id: promptId },
    { enabled: Number.isFinite(promptId) },
  );

  const closeMutation = trpc.admin.prompts.close.useMutation({
    onSuccess: () => {
      toast.success("Prompt closed");
      void detailQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  if (!Number.isFinite(promptId)) {
    return <div className="p-6 text-muted-foreground">Invalid prompt id.</div>;
  }

  if (detailQuery.isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-10">
        <Loading mode="inline" size="medium" />
      </div>
    );
  }

  if (!detailQuery.data) {
    return (
      <div className="p-6 text-muted-foreground">
        Prompt not found.{" "}
        <NavLink to="/admin/tools/prompts" className="text-primary underline">
          Back to list
        </NavLink>
      </div>
    );
  }

  const { prompt, responses, creator } = detailQuery.data;
  const isActive = prompt.status === "active";
  const isMulti = prompt.entryMode === "multi";
  const authorLabel =
    creator?.minecraftUsername ?? `Discord user ${prompt.createdBy}`;
  const groups = groupByResponder(responses);
  const countLabel = isMulti
    ? `${responses.length} ${responses.length === 1 ? "entry" : "entries"} from ${groups.length} ${groups.length === 1 ? "player" : "players"}`
    : `${responses.length} response${responses.length === 1 ? "" : "s"}`;

  return (
    <div className="flex flex-1 flex-col gap-4">
      <AdminPageHeader
        trail={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Tools", href: "/admin/tools" },
          { label: "Prompts", href: "/admin/tools/prompts" },
          { label: prompt.question },
        ]}
      />

      <div className="mx-auto w-full max-w-[1400px] flex flex-1 flex-col gap-4 px-4 pb-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-1 flex-col gap-1">
            <div className="flex items-center gap-2">
              <MessageSquare className="size-5 text-primary" />
              <h1 className="text-2xl font-semibold">{prompt.question}</h1>
              <Badge variant={isActive ? "default" : "secondary"}>
                {prompt.status}
              </Badge>
              <Badge variant="outline">
                {isMulti ? "Multiple entries" : "Single entry"}
              </Badge>
            </div>
            {prompt.description && (
              <p className="text-sm text-muted-foreground">
                {prompt.description}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Created {formatTime(prompt.createdAt)} by{" "}
              <span className="font-medium">{authorLabel}</span> • Closes{" "}
              {formatTime(prompt.endsAt)} • {countLabel}
            </p>
            <p className="text-xs text-muted-foreground/80">
              {describeEntryRules(prompt)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => void detailQuery.refetch()}
              disabled={detailQuery.isFetching}
              title="Refresh"
            >
              <RefreshCw
                className={
                  detailQuery.isFetching ? "size-4 animate-spin" : "size-4"
                }
              />
            </Button>
            {isActive && (
              <Button
                variant="outline"
                onClick={() => closeMutation.mutate({ id: prompt.id })}
                disabled={closeMutation.isPending}
              >
                <Lock className="size-4" /> Close now
              </Button>
            )}
            <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="size-4" /> Delete
            </Button>
          </div>
        </div>

        {responses.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card py-12 text-center">
            <MessageSquare className="size-8 text-muted-foreground" />
            <p className="text-muted-foreground">No responses yet.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {groups.map((group) => (
              <li
                key={group.discordId}
                className="flex gap-3 rounded-lg border border-border/60 bg-card p-3"
              >
                {group.minecraftUuid ? (
                  <img
                    src={mcHeadsAvatar(group.minecraftUuid)}
                    alt={group.minecraftUsername ?? "player"}
                    className="size-10 shrink-0 rounded bg-muted object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex size-10 shrink-0 items-center justify-center rounded bg-muted text-xs font-medium text-muted-foreground">
                    ?
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="flex items-baseline gap-2">
                      <span className="font-medium">
                        {group.minecraftUsername ??
                          `Discord user ${group.discordId}`}
                      </span>
                      {!group.minecraftUsername && (
                        <span className="text-xs text-muted-foreground">
                          (no linked Minecraft account)
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {group.entries.length > 1
                        ? `${group.entries.length} entries`
                        : formatEntryTime(group.entries[0])}
                    </span>
                  </div>
                  {group.entries.length === 1 ? (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                      {group.entries[0].responseText}
                    </p>
                  ) : (
                    <ol className="mt-2 flex flex-col gap-2">
                      {group.entries.map((entry) => (
                        <li
                          key={entry.id}
                          className="border-l-2 border-border/60 pl-3"
                        >
                          <div className="text-xs text-muted-foreground">
                            Entry #{entry.entryNumber} •{" "}
                            {formatEntryTime(entry)}
                          </div>
                          <p className="mt-0.5 whitespace-pre-wrap text-sm text-foreground">
                            {entry.responseText}
                          </p>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <DeletePromptModal
        prompt={deleteOpen ? prompt : null}
        entryCount={responses.length}
        onClose={() => setDeleteOpen(false)}
        onSuccess={() => {
          setDeleteOpen(false);
          void navigate("/admin/tools/prompts");
        }}
      />
    </div>
  );
}
