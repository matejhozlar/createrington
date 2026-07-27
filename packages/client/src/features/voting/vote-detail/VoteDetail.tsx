import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/auth";
import { useToastActions } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { NotFound } from "@/pages/not-found";
import { loaderName } from "../format";
import { ModCard } from "./components/ModCard";
import { ModDetailDialog } from "./components/ModDetailDialog";
import { SubmissionPanel } from "./components/SubmissionPanel";

export function VoteDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const toast = useToastActions();
  const utils = trpc.useUtils();
  const [openModId, setOpenModId] = useState<number | null>(null);

  const voteQuery = trpc.user.votes.get.useQuery(
    { slug: slug! },
    { enabled: !!slug, retry: false },
  );

  const voteId = voteQuery.data?.vote.id;
  const myUpvotesQuery = trpc.user.votes.myUpvotes.useQuery(
    { voteId: voteId! },
    { enabled: voteId !== undefined },
  );
  const upvotedModIds = new Set(myUpvotesQuery.data?.modIds ?? []);

  const upvoteMutation = trpc.user.votes.upvoteMod.useMutation({
    onSuccess: () => {
      if (voteId !== undefined) {
        utils.user.votes.myUpvotes.invalidate({ voteId });
      }
      utils.user.votes.get.invalidate({ slug: slug! });
    },
    onError: (err) => toast.error(err.message),
  });

  if (voteQuery.error?.data?.code === "NOT_FOUND") {
    return <NotFound />;
  }

  if (voteQuery.isLoading || !voteQuery.data) {
    return (
      <div className="px-5 py-10 md:px-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  const { vote, mods } = voteQuery.data;
  const approved = mods.filter((m) => m.status === "approved");
  const pending = mods.filter((m) => m.status === "pending");
  const isOpen = vote.status === "open";

  return (
    <div className="px-5 py-10 md:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <Link
            to="/voting"
            className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            All votes
          </Link>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold">{vote.name}</h1>
              <Badge
                variant="outline"
                className={
                  isOpen
                    ? "border-green-500/50 bg-green-500/10 text-green-400"
                    : "border-zinc-500/50 bg-zinc-500/10 text-zinc-400"
                }
              >
                {isOpen ? "Open" : "Closed"}
              </Badge>
            </div>
            {vote.description && (
              <p className="max-w-3xl text-muted-foreground">
                {vote.description}
              </p>
            )}
            <div className="flex gap-2">
              <Badge variant="outline">{vote.gameVersion}</Badge>
              <Badge variant="outline">{loaderName(vote.modLoaderType)}</Badge>
            </div>
          </div>
        </div>

        {user && isOpen && <SubmissionPanel vote={vote} />}

        <section className="space-y-4">
          <div className="flex items-baseline gap-3">
            <h2 className="text-lg font-semibold">In the pack</h2>
            <span className="text-sm text-muted-foreground">
              {approved.length} mod{approved.length !== 1 && "s"}
            </span>
          </div>
          {approved.length === 0 ? (
            <p className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
              Nothing approved yet, be the first to suggest something!
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {approved.map((mod) => (
                <ModCard
                  key={mod.id}
                  mod={mod}
                  onClick={() => setOpenModId(mod.id)}
                  upvoted={upvotedModIds.has(mod.id)}
                  canUpvote={isOpen && mod.submittedBy !== user?.discordId}
                  onUpvote={() => upvoteMutation.mutate({ voteModId: mod.id })}
                />
              ))}
            </div>
          )}
        </section>

        {pending.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-baseline gap-3">
              <h2 className="text-lg font-semibold">Awaiting review</h2>
              <span className="text-sm text-muted-foreground">
                {pending.length} suggestion{pending.length !== 1 && "s"}
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {pending.map((mod) => (
                <ModCard
                  key={mod.id}
                  mod={mod}
                  onClick={() => setOpenModId(mod.id)}
                  upvoted={upvotedModIds.has(mod.id)}
                  canUpvote={isOpen && mod.submittedBy !== user?.discordId}
                  onUpvote={() => upvoteMutation.mutate({ voteModId: mod.id })}
                />
              ))}
            </div>
          </section>
        )}

        <ModDetailDialog
          voteModId={openModId}
          onOpenChange={(open) => {
            if (!open) setOpenModId(null);
          }}
        />
      </div>
    </div>
  );
}
