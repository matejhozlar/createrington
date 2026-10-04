import type { ComponentType, SVGProps } from "react";
import { Download } from "lucide-react";
import { formatDate } from "@createrington/shared/format";
import type { LauncherChannel } from "@createrington/shared/launcher";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { AdminPageTitle } from "@/features/admin/components/AdminPageTitle";
import { ChangeTag } from "@/features/admin/components/ChangeTag";
import { HeaderActions } from "@/features/admin/components/HeaderActions";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WindowsIcon } from "@/components/icons/windows";
import { LabeledSwitch } from "@/components/labeled-switch";
import { Loading } from "@/components/loading-spinner";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import { trpc, type RouterOutput } from "@/lib/trpc";

type Release =
  RouterOutput["admin"]["launcherReleases"]["list"]["releases"][number];

const CHANNELS: Record<
  LauncherChannel,
  { label: string; description: string }
> = {
  staging: {
    label: "Staging",
    description: "Tester builds of the Createrington Launcher.",
  },
  production: {
    label: "Production",
    description: "Player builds of the Createrington Launcher.",
  },
};

const PLATFORMS = new Map<
  string,
  { label: string; icon: ComponentType<SVGProps<SVGSVGElement>> }
>([["windows-x86_64", { label: "Windows", icon: WindowsIcon }]]);

const CHANGE_TYPES = new Map<string, { label: string; color: string }>([
  ["added", { label: "Added", color: "var(--c-add)" }],
  ["improved", { label: "Improved", color: "var(--c-tweak)" }],
  ["fixed", { label: "Fixed", color: "var(--c-fix)" }],
  ["changed", { label: "Changed", color: "var(--c-change)" }],
  ["removed", { label: "Removed", color: "var(--c-remove)" }],
]);

const UNKNOWN_CHANGE_COLOR = "var(--c-change)";

const CDN_FLAG = {
  name: "launcher_curseforge_cdn",
  id: "launcher-curseforge-cdn-enabled",
  label: "CurseForge CDN fallback",
  description:
    "Serve pack files CurseForge gives no link for from their built address on CurseForge's CDN",
} as const;

function changeTag(type: string): { label: string; color: string } {
  return CHANGE_TYPES.get(type) ?? { label: type, color: UNKNOWN_CHANGE_COLOR };
}

export function AdminLauncher() {
  const utils = trpc.useUtils();
  const releasesQuery = trpc.admin.launcherReleases.list.useQuery();

  const flagsQuery = trpc.admin.features.list.useQuery();
  const cdnEnabled =
    flagsQuery.data?.find((flag) => flag.name === CDN_FLAG.name)?.enabled ??
    false;

  const setFlagMutation = trpc.admin.features.set.useMutation(
    useMutationToast({
      success: (flag) =>
        `${CDN_FLAG.label} ${flag.enabled ? "enabled" : "disabled"}`,
      onSuccess: () => utils.admin.features.list.invalidate(),
    }),
  );

  const channel = releasesQuery.data?.channel;
  const [latest, ...earlier] = releasesQuery.data?.releases ?? [];

  return (
    <div className="flex flex-1 flex-col gap-4">
      <AdminPageHeader
        trail={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Launcher" },
        ]}
      />

      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-4 px-4 pb-4">
        <AdminPageTitle
          title="Launcher"
          badges={
            channel && (
              <Badge variant="outline">{CHANNELS[channel].label}</Badge>
            )
          }
          description={channel && CHANNELS[channel].description}
          actions={
            <LabeledSwitch
              id={CDN_FLAG.id}
              label={CDN_FLAG.label}
              checked={cdnEnabled}
              disabled={
                flagsQuery.isLoading ||
                !!flagsQuery.error ||
                setFlagMutation.isPending
              }
              onCheckedChange={(checked) =>
                setFlagMutation.mutate({
                  name: CDN_FLAG.name,
                  enabled: checked,
                  description: CDN_FLAG.description,
                })
              }
            />
          }
        />

        {releasesQuery.isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <Loading size="medium" text="Loading launcher versions..." />
          </div>
        ) : releasesQuery.isError ? (
          <p className="py-8 text-center text-destructive">
            Failed to load launcher versions: {releasesQuery.error.message}
          </p>
        ) : !latest ? (
          <Card>
            <CardContent>
              <p className="py-8 text-center text-muted-foreground">
                No launcher version has been released yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <LatestRelease release={latest} />
            {earlier.length > 0 && <EarlierReleases releases={earlier} />}
          </>
        )}
      </div>
    </div>
  );
}

function LatestRelease({ release }: { release: Release }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-auto flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Latest version
            </span>
            <span className="font-mono text-5xl font-semibold leading-none text-primary">
              {release.version}
            </span>
            <span className="text-sm text-muted-foreground">
              Released {formatDate(release.releasedAt)}
            </span>
          </div>
          <HeaderActions>
            <DownloadButton release={release} size="icon-lg" />
          </HeaderActions>
        </div>

        <ReleaseNotes release={release} />
      </CardContent>
    </Card>
  );
}

function EarlierReleases({ releases }: { releases: Release[] }) {
  return (
    <Card className="gap-2">
      <CardHeader>
        <CardTitle className="text-base">Earlier versions</CardTitle>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple">
          {releases.map((release) => (
            <AccordionItem key={release.id} value={String(release.id)}>
              <AccordionTrigger className="hover:no-underline">
                <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-mono text-sm font-semibold text-foreground">
                    {release.version}
                  </span>
                  <span className="text-sm font-normal text-muted-foreground">
                    {formatDate(release.releasedAt)}
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="flex flex-col gap-4">
                <ReleaseNotes release={release} />
                <div>
                  <DownloadButton release={release} size="icon-sm" />
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}

function DownloadButton({
  release,
  size,
}: {
  release: Release;
  size: "icon-sm" | "icon-lg";
}) {
  const platform = PLATFORMS.get(release.platform);
  const Icon = platform?.icon ?? Download;
  const label = `Download for ${platform?.label ?? release.platform}`;

  return (
    <Button
      asChild
      size={size}
      variant={size === "icon-lg" ? "default" : "outline"}
    >
      <a
        href={release.url}
        rel="noopener noreferrer"
        aria-label={label}
        title={label}
      >
        <Icon aria-hidden />
      </a>
    </Button>
  );
}

function ReleaseNotes({ release }: { release: Release }) {
  const { structuredNotes, notes } = release;

  if (!structuredNotes) {
    return (
      <p className="whitespace-pre-line text-sm text-muted-foreground">
        {notes || "No notes for this version."}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-foreground">{structuredNotes.summary}</p>
      {structuredNotes.changes.length > 0 && (
        <ul className="m-0 grid list-none grid-cols-1 gap-x-3 gap-y-3 p-0 xs:grid-cols-[auto_1fr]">
          {structuredNotes.changes.map((change, index) => (
            <li
              key={index}
              className="col-span-full grid grid-cols-subgrid items-start gap-y-1"
            >
              <ChangeTag
                {...changeTag(change.type)}
                className="min-w-20 justify-self-start"
              />
              <div className="flex min-w-0 flex-col gap-0.5 text-sm">
                <span className="font-medium text-foreground">
                  {change.title}
                </span>
                <span className="text-muted-foreground">
                  {change.description}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
