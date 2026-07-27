import { Link } from "react-router-dom";
import { ChevronRight, Heart, Vote as VoteIcon } from "lucide-react";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { mcHeadsAvatar } from "@/lib/external-urls";
import { formatDate, loaderName } from "./format";

const HERO_IMAGE = "/assets/hero/royal-albert-hall.webp";

const STAT_LABEL_CLASS =
  "text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground";

type VoteListItem = RouterOutput["user"]["votes"]["list"][number];

export function Voting() {
  const votesQuery = trpc.user.votes.list.useQuery();
  const votes = votesQuery.data ?? [];
  const openVotes = votes.filter((vote) => vote.status === "open");
  const closedVotes = votes.filter((vote) => vote.status === "closed");

  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-x-0 top-0 h-[680px] overflow-hidden">
        <img
          src={HERO_IMAGE}
          alt=""
          className="h-full w-full object-cover grayscale-50"
        />
        <div className="absolute inset-0 bg-black/30" />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, var(--background) 0%, oklch(from var(--background) l c h / 0.75) 40%, oklch(from var(--background) l c h / 0.25) 75%, transparent 100%)",
          }}
        />
      </div>

      <header className="relative px-5 pb-10 pt-18 md:px-8">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-4xl font-semibold text-shadow-[0_2px_8px_rgb(0_0_0/0.5)] md:text-5xl lg:text-6xl">
            Voting
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-zinc-200 text-shadow-[0_1px_4px_rgb(0_0_0/0.5)] md:text-xl lg:text-2xl">
            Suggest mods, back your favorites, and decide together what ships in
            the next pack.
          </p>
        </div>
      </header>

      <section className="relative px-5 pb-16 pt-2 md:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-12">
          <div>
            <h2 className="mb-4 text-3xl font-semibold">Active vote</h2>
            {votesQuery.isLoading ? (
              <Skeleton className="h-80 w-full rounded-xl" />
            ) : openVotes.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="flex flex-col gap-6">
                {openVotes.map((vote) => (
                  <ActiveVoteCard key={vote.id} vote={vote} />
                ))}
              </div>
            )}
          </div>

          {closedVotes.length > 0 && <EarlierVotes votes={closedVotes} />}
        </div>
      </section>
    </div>
  );
}

function ActiveVoteCard({ vote }: { vote: VoteListItem }) {
  const summary = vote.summary;
  const suggestionCount = summary
    ? summary.approvedModCount + summary.pendingModCount
    : 0;

  return (
    <Card className="grid gap-0 overflow-hidden py-0 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex flex-col gap-6 p-8">
        <div className="flex flex-col gap-2.5">
          <h3 className="text-[28px] leading-[34px] font-semibold">
            {vote.name}
          </h3>
          {vote.description && (
            <p className="max-w-[560px] text-[15px] leading-6 text-muted-foreground">
              {vote.description}
            </p>
          )}
          <div className="mt-0.5 flex gap-2">
            <Badge variant="outline">{vote.gameVersion}</Badge>
            <Badge variant="outline">{loaderName(vote.modLoaderType)}</Badge>
          </div>
        </div>

        {summary && (
          <div className="flex flex-wrap gap-12 border-t border-border pt-5">
            <VoteStat
              label="In the pack"
              value={summary.approvedModCount}
              unit={summary.approvedModCount === 1 ? "mod" : "mods"}
            />
            <VoteStat
              label="Awaiting review"
              value={summary.pendingModCount}
              unit={
                summary.pendingModCount === 1 ? "suggestion" : "suggestions"
              }
            />
            <div>
              <div className={STAT_LABEL_CLASS}>Players voting</div>
              <div className="mt-1.5 flex items-center gap-2.5">
                <span className="font-mono text-[22px] leading-7 font-semibold">
                  {summary.participantCount}
                </span>
                {summary.participantSample.length > 0 && (
                  <span className="inline-flex pl-1.5">
                    {summary.participantSample.map((player) => (
                      <img
                        key={player.minecraftUuid}
                        src={mcHeadsAvatar(player.minecraftUuid, 24)}
                        alt={player.minecraftUsername}
                        width={24}
                        height={24}
                        className="-ml-1.5 rounded-xs outline-2 outline-card [image-rendering:pixelated]"
                      />
                    ))}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="mt-1 flex flex-wrap items-center gap-4">
          <Button size="lg" asChild>
            <Link to={`/voting/${vote.slug}`}>Suggest &amp; upvote mods</Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-4 border-t border-border bg-accent/20 p-7 lg:border-l lg:border-t-0">
        <div className={STAT_LABEL_CLASS}>Leading suggestions</div>
        {summary && summary.topMods.length > 0 ? (
          <div className="flex flex-col gap-3.5">
            {summary.topMods.map((mod, index) => (
              <div key={mod.voteModId} className="flex items-center gap-3">
                <span className="w-3.5 font-mono text-xs text-muted-foreground">
                  {index + 1}
                </span>
                {mod.thumbnailUrl ? (
                  <img
                    src={mod.thumbnailUrl}
                    alt=""
                    className="size-9 shrink-0 rounded-sm object-cover"
                  />
                ) : (
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-secondary text-[13px] font-semibold text-muted-foreground">
                    {modInitials(mod.name)}
                  </span>
                )}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-semibold">
                    {mod.name}
                  </span>
                  {mod.primaryAuthor && (
                    <span className="truncate text-xs text-muted-foreground">
                      by {mod.primaryAuthor}
                    </span>
                  )}
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Heart className="size-3" />
                  {mod.upvoteCount}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No suggestions yet. Be the first to submit one!
          </p>
        )}
        <Link
          to={`/voting/${vote.slug}`}
          className="mt-auto inline-flex items-center gap-1 text-[13px] font-medium text-primary transition hover:brightness-110"
        >
          See all {suggestionCount}{" "}
          {suggestionCount === 1 ? "suggestion" : "suggestions"}
          <ChevronRight className="size-3.5" />
        </Link>
      </div>
    </Card>
  );
}

function VoteStat({
  label,
  value,
  unit,
}: {
  label: string;
  value: number;
  unit: string;
}) {
  return (
    <div>
      <div className={STAT_LABEL_CLASS}>{label}</div>
      <div className="mt-1.5 font-mono text-[22px] leading-7 font-semibold">
        {value}{" "}
        <span className="font-sans text-[13px] font-normal text-muted-foreground">
          {unit}
        </span>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-[var(--border-strong)] px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-lg bg-[var(--primary-glow)]">
        <VoteIcon className="size-[22px] text-primary" />
      </div>
      <div className="text-lg font-semibold">No votes running right now</div>
      <p className="max-w-[400px] text-sm leading-[22px] text-muted-foreground">
        When the next vote opens, it&apos;ll show up here. Keep an eye on the
        Discord announcements.
      </p>
    </div>
  );
}

function EarlierVotes({ votes }: { votes: VoteListItem[] }) {
  return (
    <div>
      <h2 className="mb-4 text-3xl font-semibold">Earlier votes</h2>
      <div className="flex flex-col gap-3">
        {votes.map((vote) => (
          <Link key={vote.id} to={`/voting/${vote.slug}`} className="block">
            <Card className="flex-row items-center gap-4 px-6 py-[18px] transition-colors hover:border-primary/40">
              <span className="text-[15px] font-semibold">{vote.name}</span>
              <span className="rounded-full border border-zinc-500/50 bg-zinc-500/10 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-zinc-400">
                Closed
              </span>
              <span className="flex-1" />
              <span className="text-[13px] text-muted-foreground">
                {vote.gameVersion} · {loaderName(vote.modLoaderType)} · Closed{" "}
                {formatDate(vote.updatedAt)}
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

function modInitials(name: string): string {
  const letters = name
    .split(/\s+/)
    .map((word) => word.replace(/[^a-z0-9]/gi, "").charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return letters || "?";
}
