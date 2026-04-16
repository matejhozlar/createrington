import { useParams, NavLink } from "react-router-dom";
import { Loading } from "@/components/loading-spinner";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Lock, RefreshCw } from "lucide-react";
import { mcHeadsAvatar } from "@/lib/external-urls";
import { trpc } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";

function formatTime(date: Date | string): string {
  return new Date(date).toLocaleString();
}

export function PromptDetail() {
  const { id } = useParams<{ id: string }>();
  const promptId = id ? parseInt(id, 10) : NaN;
  const toast = useToastActions();

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
  const authorLabel =
    creator?.minecraftUsername ?? `Discord user ${prompt.createdBy}`;

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <NavLink to="/admin/dashboard">Admin</NavLink>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <NavLink to="/admin/tools">Tools</NavLink>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <NavLink to="/admin/tools/prompts">Prompts</NavLink>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="line-clamp-1 max-w-md">
              {prompt.question}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-1 flex-col gap-1">
            <div className="flex items-center gap-2">
              <MessageSquare className="size-5 text-primary" />
              <CardTitle>{prompt.question}</CardTitle>
              <Badge variant={isActive ? "default" : "secondary"}>
                {prompt.status}
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
              {formatTime(prompt.endsAt)} • {responses.length} response
              {responses.length === 1 ? "" : "s"}
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
                variant="destructive"
                onClick={() => closeMutation.mutate({ id: prompt.id })}
                disabled={closeMutation.isPending}
              >
                <Lock className="size-4" /> Close now
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {responses.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <MessageSquare className="size-8 text-muted-foreground" />
              <p className="text-muted-foreground">No responses yet.</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {responses.map((r) => (
                <li
                  key={r.id}
                  className="flex gap-3 rounded-lg border border-border/60 bg-card p-3"
                >
                  {r.minecraftUuid ? (
                    <img
                      src={mcHeadsAvatar(r.minecraftUuid)}
                      alt={r.minecraftUsername ?? "player"}
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
                          {r.minecraftUsername ?? `Discord user ${r.discordId}`}
                        </span>
                        {!r.minecraftUsername && (
                          <span className="text-xs text-muted-foreground">
                            (no linked Minecraft account)
                          </span>
                        )}
                      </div>
                      <span
                        className="text-xs text-muted-foreground"
                        title={formatTime(r.submittedAt)}
                      >
                        {formatTime(r.submittedAt)}
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                      {r.responseText}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
