import {
  Bug,
  Calendar,
  Code2,
  Download,
  ExternalLink,
  Globe,
  Heart,
  TrendingUp,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { formatDate, formatDownloads, MOD_STATUS_STYLES } from "../../format";

interface ProjectCategory {
  name: string;
  slug: string;
}

interface ProjectScreenshot {
  title: string;
  thumbnailUrl: string;
  url: string;
}

interface ProjectLinks {
  website?: string | null;
  wiki?: string | null;
  issues?: string | null;
  source?: string | null;
}

export function ModDetailDialog({
  voteModId,
  onOpenChange,
  admin = false,
}: {
  voteModId: number | null;
  onOpenChange: (open: boolean) => void;
  admin?: boolean;
}) {
  const userQuery = trpc.user.votes.getMod.useQuery(
    { voteModId: voteModId! },
    { enabled: voteModId !== null && !admin },
  );
  const adminQuery = trpc.admin.votes.getMod.useQuery(
    { voteModId: voteModId! },
    { enabled: voteModId !== null && admin },
  );
  const detailQuery = admin ? adminQuery : userQuery;

  const data = detailQuery.data;
  const project = data?.project;
  const categories = (project?.categories ??
    []) as unknown as ProjectCategory[];
  const screenshots = (project?.screenshots ??
    []) as unknown as ProjectScreenshot[];
  const links = (project?.links ?? {}) as unknown as ProjectLinks;
  const status = data ? MOD_STATUS_STYLES[data.mod.status] : null;

  const linkEntries = [
    { label: "CurseForge", href: links.website, icon: ExternalLink },
    { label: "Wiki", href: links.wiki, icon: Globe },
    { label: "Issues", href: links.issues, icon: Bug },
    { label: "Source", href: links.source, icon: Code2 },
  ].filter((l) => !!l.href);

  return (
    <Dialog open={voteModId !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        {detailQuery.isLoading || !data || !project ? (
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
                </div>
              </div>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat
                icon={Download}
                label="Downloads"
                value={formatDownloads(project.downloadCount)}
              />
              <Stat
                icon={TrendingUp}
                label="Popularity"
                value={
                  project.gamePopularityRank
                    ? `#${project.gamePopularityRank}`
                    : "n/a"
                }
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

            {linkEntries.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {linkEntries.map(({ label, href, icon: Icon }) => (
                  <a
                    key={label}
                    href={href!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <Icon className="size-3" />
                    {label}
                  </a>
                ))}
              </div>
            )}

            {data.mod.note && (
              <div className="rounded-lg border bg-accent/30 p-3 text-sm">
                <span className="font-medium">Submitter's note:</span>{" "}
                {data.mod.note}
              </div>
            )}

            {screenshots.length > 0 && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {screenshots.slice(0, 6).map((shot) => (
                  <a
                    key={shot.url}
                    href={shot.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <img
                      src={shot.thumbnailUrl}
                      alt={shot.title}
                      className="aspect-video w-full rounded-lg object-cover transition-opacity hover:opacity-80"
                      loading="lazy"
                    />
                  </a>
                ))}
              </div>
            )}

            {project.descriptionHtml && (
              <>
                <Separator />
                <div
                  className="max-w-none text-sm leading-relaxed [&_a]:text-primary [&_a]:underline-offset-2 hover:[&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_code]:rounded [&_code]:bg-accent [&_code]:px-1 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold [&_h3]:font-semibold [&_img]:my-2 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-lg [&_li]:ml-4 [&_ol]:list-decimal [&_p]:my-2 [&_table]:w-full [&_td]:border [&_td]:p-1.5 [&_th]:border [&_th]:p-1.5 [&_ul]:list-disc"
                  // Sanitized server-side at ingest with a strict allowlist
                  dangerouslySetInnerHTML={{ __html: project.descriptionHtml }}
                />
              </>
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
