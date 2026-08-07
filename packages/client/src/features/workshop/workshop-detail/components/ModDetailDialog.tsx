import {
  Calendar,
  Download,
  ExternalLink,
  Heart,
  MessageSquare,
  User,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { PlayerLabel } from "@/components/player-label";
import {
  formatDate,
  formatDownloads,
  modCredit,
  MOD_STATUS_STYLES,
} from "../../format";

interface ProjectCategory {
  name: string;
  slug: string;
}

interface ProjectScreenshot {
  title: string;
  thumbnailUrl: string;
  url: string;
}

function isHttpUrl(url: string | null | undefined): url is string {
  return !!url && /^https?:\/\//i.test(url);
}

export function ModDetailDialog({
  workshopModId,
  onOpenChange,
  admin = false,
}: {
  workshopModId: number | null;
  onOpenChange: (open: boolean) => void;
  admin?: boolean;
}) {
  const userQuery = trpc.user.workshops.getMod.useQuery(
    { workshopModId: workshopModId! },
    { enabled: workshopModId !== null && !admin },
  );
  const adminQuery = trpc.admin.workshops.getMod.useQuery(
    { workshopModId: workshopModId! },
    { enabled: workshopModId !== null && admin },
  );
  const detailQuery = admin ? adminQuery : userQuery;

  const data = detailQuery.data;
  const project = data?.project;
  const categories = (project?.categories ??
    []) as unknown as ProjectCategory[];
  const screenshots = (
    (project?.screenshots ?? []) as unknown as ProjectScreenshot[]
  ).filter((shot) => isHttpUrl(shot.url) && isHttpUrl(shot.thumbnailUrl));
  const status = data
    ? data.mod.live
      ? {
          label: "Live",
          className: "border-green-500/50 bg-green-500/10 text-green-400",
        }
      : MOD_STATUS_STYLES[data.mod.status]
    : null;
  const credit = modCredit(data?.mod.submitterName ?? null);

  return (
    <Dialog open={workshopModId !== null} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[85vh] max-w-3xl overflow-y-auto"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        {detailQuery.error ? (
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <p className="text-sm text-destructive">
              {detailQuery.error.message}
            </p>
            <Button
              variant="outline"
              onClick={() => {
                if (admin) adminQuery.refetch();
                else userQuery.refetch();
              }}
            >
              Try Again
            </Button>
          </div>
        ) : detailQuery.isLoading || !data || !project ? (
          <div className="space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-start gap-4">
                {project.thumbnailUrl && (
                  <img
                    src={project.thumbnailUrl}
                    alt=""
                    className="size-16 shrink-0 rounded-xl"
                  />
                )}
                <div className="min-w-0 flex-1 space-y-1 text-left">
                  <DialogTitle className="text-xl">{project.name}</DialogTitle>
                  <DialogDescription>
                    by {project.primaryAuthor ?? "unknown"}
                    {project.summary ? ` — ${project.summary}` : ""}
                  </DialogDescription>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {status && (
                      <Badge
                        variant="outline"
                        className={`text-xs ${status.className}`}
                      >
                        {status.label}
                      </Badge>
                    )}
                    {categories.slice(0, 4).map((c) => (
                      <Badge
                        key={c.slug}
                        variant="secondary"
                        className="text-xs"
                      >
                        {c.name}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
                    {data.mod.submitterName ? (
                      <>
                        {credit.verb}{" "}
                        <PlayerLabel
                          name={data.mod.submitterName}
                          playerId={data.mod.submittedBy}
                          size={16}
                        />
                      </>
                    ) : (
                      <>
                        <User className="size-3" />
                        {credit.verb}{" "}
                        <span className="font-medium text-foreground">
                          {credit.name}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </DialogHeader>

            <div className="grid grid-cols-3 gap-3">
              <Stat
                icon={Download}
                label="Downloads"
                value={formatDownloads(project.downloadCount)}
              />
              <Stat
                icon={Calendar}
                label="Last release"
                value={formatDate(project.dateReleased)}
              />
              <Stat
                icon={Heart}
                label="Upvotes"
                value={String(data.upvoteCount)}
              />
            </div>

            {data.mod.note && (
              <div className="rounded-lg border bg-accent/30 p-3 text-sm">
                <span className="font-medium">Submitter's note:</span>{" "}
                {data.mod.note}
              </div>
            )}

            {data.mod.dependencies.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium">Dependencies</div>
                <div className="space-y-1.5">
                  {data.mod.dependencies.map((dep) => (
                    <div
                      key={dep.curseforgeProjectId}
                      className="flex items-center gap-2.5 rounded-lg border p-2 text-sm"
                    >
                      {dep.thumbnailUrl ? (
                        <img
                          src={dep.thumbnailUrl}
                          alt=""
                          className="size-7 rounded"
                        />
                      ) : (
                        <div className="size-7 rounded bg-accent" />
                      )}
                      <span className="min-w-0 flex-1 truncate">
                        {dep.name ?? `Project #${dep.curseforgeProjectId}`}
                      </span>
                      <Badge
                        variant={
                          dep.relationType === 3 ? "outline" : "secondary"
                        }
                        className="text-xs"
                      >
                        {dep.relationType === 3 ? "Required" : "Optional"}
                      </Badge>
                      {dep.rejected && (
                        <Badge
                          variant="outline"
                          className="border-red-500/50 text-xs text-red-400"
                        >
                          Rejected
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {screenshots.length === 1 && (
              <a
                href={screenshots[0].url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <img
                  src={screenshots[0].url}
                  alt={screenshots[0].title}
                  className="aspect-video w-full rounded-lg object-cover transition-opacity hover:opacity-80"
                  loading="lazy"
                />
              </a>
            )}
            {screenshots.length > 1 && (
              <Carousel className="w-full">
                <CarouselContent>
                  {screenshots.map((shot) => (
                    <CarouselItem key={shot.url}>
                      <a
                        href={shot.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <img
                          src={shot.url}
                          alt={shot.title}
                          className="aspect-video w-full rounded-lg object-cover"
                          loading="lazy"
                        />
                      </a>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious className="left-2" />
                <CarouselNext className="right-2" />
              </Carousel>
            )}

            {isHttpUrl(project.websiteUrl) && (
              <Button variant="outline" className="w-full" asChild>
                <a
                  href={project.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="size-4" />
                  View full description on CurseForge
                </a>
              </Button>
            )}

            {data.mod.discordThreadUrl && (
              <Button variant="outline" className="w-full" asChild>
                <a
                  href={data.mod.discordThreadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageSquare className="size-4" />
                  Discuss on Discord
                </a>
              </Button>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Download;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3" />
        {label}
      </div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}
