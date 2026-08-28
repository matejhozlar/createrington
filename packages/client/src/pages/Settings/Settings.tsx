import type React from "react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/auth";
import { MinecraftAvatar } from "@/components/minecraft-avatar";
import { Sensitive } from "@/components/sensitive";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useToastActions } from "@/hooks/use-toast";
import {
  Monitor,
  Smartphone,
  Globe,
  LogOut,
  Shield,
  User,
  Gamepad2,
  Download,
  Trash2,
} from "lucide-react";

/**
 * Parses a raw User-Agent string into a human-readable label and device icon
 *
 * @param ua - Raw User-Agent header value, or null if unavailable
 * @returns Object containing a display label (browser + OS) and a matching icon component
 */
function parseUserAgent(ua: string | null): {
  label: string;
  icon: typeof Monitor;
} {
  if (!ua) return { label: "Unknown device", icon: Globe };
  const isMobile = /mobile|android|iphone|ipad/i.test(ua);
  const browser =
    ua.match(/(Chrome|Firefox|Safari|Edge|Opera)\/[\d.]+/)?.[0] ??
    "Unknown browser";
  const os =
    ua.match(/(Windows|Mac OS X|Linux|Android|iOS)[\s/]?[\d._]*/)?.[0] ?? "";
  return {
    label: `${browser}${os ? ` — ${os}` : ""}`,
    icon: isMobile ? Smartphone : Monitor,
  };
}

/** Formats an ISO date string as a short locale date (e.g. "Jan 1, 2024") */
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Formats an ISO date string as a relative time label (e.g. "3h ago", "Just now") */
function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** Displays the linked Minecraft and Discord account details for the current user */
function AccountSection() {
  const { data, isLoading } = trpc.user.account.me.useQuery();

  if (isLoading || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Skeleton className="size-12 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-4 w-28" />
            </div>
            <Skeleton className="ml-auto h-5 w-16 rounded-full" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <Skeleton className="h-14 rounded-lg" />
            <Skeleton className="h-14 rounded-lg" />
            <Skeleton className="h-14 rounded-lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Account</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <MinecraftAvatar
            username={data.minecraftUsername}
            uuid={data.minecraftUuid}
            size={48}
          />
          <div className="space-y-1">
            <p className="text-lg font-semibold">{data.minecraftUsername}</p>
            <p className="text-sm text-muted-foreground">
              Discord: {data.discordUsername}
            </p>
          </div>
          <Badge
            variant={data.role === "admin" ? "default" : "secondary"}
            className="ml-auto capitalize"
          >
            {data.role === "admin" && <Shield className="size-3 mr-1" />}
            {data.role === "admin" ? "Admin" : "Member"}
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <InfoItem icon={User} label="Discord ID" value={data.discordId} />
          <InfoItem
            icon={Gamepad2}
            label="Minecraft UUID"
            value={data.minecraftUuid.slice(0, 8) + "..."}
            title={data.minecraftUuid}
          />
          <InfoItem
            icon={Globe}
            label="Member since"
            value={formatDate(data.createdAt)}
          />
        </div>
      </CardContent>
    </Card>
  );
}

/** Renders a single labelled metadata field with an icon */
function InfoItem({
  icon: Icon,
  label,
  value,
  title,
}: {
  icon: typeof User;
  label: string;
  value: string;
  title?: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-card/50 px-3 py-2.5">
      <Icon className="size-4 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </p>
        <p className="text-sm font-mono truncate" title={title}>
          {value}
        </p>
      </div>
    </div>
  );
}

/** Lists all active JWT sessions with device info and per-session revoke controls */
function SessionsSection() {
  const { data: sessions, isLoading } = trpc.user.account.sessions.useQuery();
  const utils = trpc.useUtils();
  const revokeMutation = trpc.user.account.revokeSession.useMutation({
    onSuccess: () => utils.user.account.sessions.invalidate(),
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active Sessions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-lg border px-3 py-2.5"
            >
              <Skeleton className="size-5 rounded" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-8 w-16 rounded-md" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Active Sessions
          {sessions && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({sessions.length})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!sessions || sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active sessions</p>
        ) : (
          sessions.map((session) => {
            const { label, icon: DeviceIcon } = parseUserAgent(
              session.userAgent,
            );

            return (
              <div
                key={session.id}
                className="flex items-center gap-3 rounded-lg border px-3 py-2.5"
              >
                <DeviceIcon className="size-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{label}</p>
                  <p className="text-xs text-muted-foreground">
                    {session.ipAddress && (
                      <span className="mr-3">
                        IP:{" "}
                        <Sensitive
                          value={session.ipAddress}
                          label="IP address"
                        />
                      </span>
                    )}
                    Last active: {formatRelative(session.lastUsedAt)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive shrink-0"
                  onClick={() => revokeMutation.mutate({ id: session.id })}
                  disabled={revokeMutation.isPending}
                >
                  Revoke
                </Button>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

/** Renders a single row in the Danger Zone card with a title, description, and action button */
function DangerZoneRow({
  title,
  description,
  button,
}: {
  title: string;
  description: string;
  button: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {button}
    </div>
  );
}

/** Fetches the current user's data export on demand and triggers a JSON file download */
function ExportDataButton() {
  const { isFetching, refetch } = trpc.user.account.exportData.useQuery(
    undefined,
    { enabled: false },
  );

  const handleExport = async () => {
    const result = await refetch();
    if (result.data) {
      const blob = new Blob([JSON.stringify(result.data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `createrington-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="shrink-0"
      onClick={handleExport}
      loading={isFetching}
    >
      <Download className="size-4 mr-1.5" />
      Export
    </Button>
  );
}

/** Opens a confirmation dialog requiring the user to type a phrase before permanently deleting their account */
function DeleteAccountButton() {
  const { logout } = useAuth();
  const toast = useToastActions();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");

  const deleteMutation = trpc.user.account.deleteAccount.useMutation({
    onSuccess: () => logout(),
    onError: (error) =>
      toast.error(error.message || "Failed to delete account"),
  });

  const isValid = confirmation === "DELETE MY ACCOUNT";

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="size-4 mr-1.5" />
        Delete
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setConfirmation("");
        }}
        title="Delete your account?"
        description={
          <span className="block space-y-2">
            <span className="block">
              This will permanently delete all your data including playtime,
              economy, achievements, and moderation records. You will also be
              removed from the Discord server.
            </span>
            <span className="block font-medium text-destructive">
              This action cannot be undone.
            </span>
            <span className="block pt-1">
              Type{" "}
              <span className="font-mono font-bold">DELETE MY ACCOUNT</span> to
              confirm:
            </span>
          </span>
        }
        confirmLabel="Permanently delete account"
        variant="destructive"
        confirmDisabled={!isValid}
        onConfirm={() => deleteMutation.mutateAsync({ confirmation })}
      >
        <Input
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          placeholder="DELETE MY ACCOUNT"
          className="font-mono"
        />
      </ConfirmDialog>
    </>
  );
}

/** Groups destructive account actions: data export, account deletion, and global session logout */
function DangerZone() {
  const { logoutAll } = useAuth();
  const [logoutOpen, setLogoutOpen] = useState(false);

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="text-base text-destructive">
          Danger Zone
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <DangerZoneRow
          title="Export my data"
          description="Download a copy of all personal data we store about you"
          button={<ExportDataButton />}
        />

        <DangerZoneRow
          title="Delete account"
          description="Permanently delete your account and all associated data"
          button={<DeleteAccountButton />}
        />

        <DangerZoneRow
          title="Log out everywhere"
          description="Revoke all active sessions including this one"
          button={
            <>
              <Button
                variant="destructive"
                size="sm"
                className="shrink-0"
                onClick={() => setLogoutOpen(true)}
              >
                <LogOut className="size-4 mr-1.5" />
                Logout All
              </Button>
              <ConfirmDialog
                open={logoutOpen}
                onOpenChange={setLogoutOpen}
                title="Log out of all sessions?"
                description="This will revoke all active sessions and log you out of every device, including this one. You'll need to log in again."
                confirmLabel="Log out everywhere"
                variant="destructive"
                onConfirm={() => logoutAll()}
              />
            </>
          }
        />
      </CardContent>
    </Card>
  );
}

/** Account Settings page: combines account info, active sessions, and danger zone actions */
export function Settings() {
  return (
    <div className="flex flex-1 flex-col px-5 md:px-8 pt-5 pb-16">
      <div className="max-w-3xl mx-auto w-full space-y-5">
        <h1 className="text-xl font-bold tracking-tight">Account Settings</h1>

        <AccountSection />
        <SessionsSection />
        <DangerZone />
      </div>
    </div>
  );
}
