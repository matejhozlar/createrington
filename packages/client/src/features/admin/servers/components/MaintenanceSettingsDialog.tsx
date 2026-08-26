import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { MinecraftAvatar } from "@/components/minecraft-avatar";
import { MinecraftText } from "@/components/minecraft-text";
import { PlayerLabel } from "@/components/player-label";
import { RefreshCw, RotateCcw, Search, X } from "lucide-react";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useToastActions } from "@/hooks/use-toast";

interface MaintenanceSettingsDialogProps {
  serverId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MOTD_MAX_LENGTH = 300;
const MESSAGE_MAX_LENGTH = 600;

const PREVIEW_SAMPLE = { server: "Cogs & Steam", eta: "~30 min" };

const TEXTAREA_CLASS =
  "w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function previewText(template: string): string {
  return template
    .replace(/\{server\}/g, PREVIEW_SAMPLE.server)
    .replace(/\{eta\}/g, PREVIEW_SAMPLE.eta);
}

interface TemplateFieldProps {
  id: string;
  label: string;
  hint: string;
  value: string;
  preset: string;
  maxLength: number;
  rows: number;
  onChange: (value: string) => void;
}

function TemplateField({
  id,
  label,
  hint,
  value,
  preset,
  maxLength,
  rows,
  onChange,
}: TemplateFieldProps) {
  const isPreset = value === preset;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={isPreset}
          onClick={() => onChange(preset)}
        >
          <RotateCcw className="mr-1 size-3" />
          Reset to preset
        </Button>
      </div>
      <textarea
        id={id}
        value={value}
        rows={rows}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        className={TEXTAREA_CLASS}
      />
      <div className="flex items-start justify-between gap-4">
        <p className="text-xs text-muted-foreground">{hint}</p>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {value.length}/{maxLength}
        </span>
      </div>
      <MinecraftText
        text={previewText(value)}
        className="rounded-md border border-border bg-[#111] px-3 py-2 text-xs text-gray-200"
      />
    </div>
  );
}

type MaintenanceSettings =
  RouterOutput["admin"]["servers"]["maintenanceSettings"];

export function MaintenanceSettingsDialog({
  serverId,
  open,
  onOpenChange,
}: MaintenanceSettingsDialogProps) {
  const settingsQuery = trpc.admin.servers.maintenanceSettings.useQuery(
    { serverId },
    { enabled: open },
  );
  const settings = settingsQuery.data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Maintenance settings</DialogTitle>
          <DialogDescription>
            What players see while maintenance is on, and who can still join.
            Stored here and pushed to the server whenever it changes.
          </DialogDescription>
        </DialogHeader>

        {!settings ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : (
          <MaintenanceSettingsForm
            key={serverId}
            serverId={serverId}
            settings={settings}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface MaintenanceSettingsFormProps {
  serverId: number;
  settings: MaintenanceSettings;
  onClose: () => void;
}

function MaintenanceSettingsForm({
  serverId,
  settings,
  onClose,
}: MaintenanceSettingsFormProps) {
  const toast = useToastActions();
  const utils = trpc.useUtils();

  const [motd, setMotd] = useState(settings.motd ?? settings.presets.motd);
  const [message, setMessage] = useState(
    settings.message ?? settings.presets.message,
  );

  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);
  const searchQuery = trpc.public.players.list.useQuery(
    { minecraftUsername: debouncedQuery, limit: 8, page: 0 },
    { enabled: debouncedQuery.trim().length > 0 },
  );

  const invalidateSettings = () =>
    utils.admin.servers.maintenanceSettings.invalidate({ serverId });

  const saveMutation = trpc.admin.servers.updateMaintenanceSettings.useMutation(
    {
      onSuccess: ({ pushed }) => {
        toast.success(
          pushed
            ? "Maintenance messages saved and pushed to the server"
            : "Maintenance messages saved; the server is unreachable and will receive them when it's back",
        );
        invalidateSettings();
      },
      onError: (err: { message: string }) => toast.error(err.message),
    },
  );

  const addMutation =
    trpc.admin.servers.addMaintenanceAllowedPlayer.useMutation({
      onSuccess: ({ username, pushed }) => {
        toast.success(
          pushed
            ? `${username} can now join during maintenance`
            : `${username} added; the server is unreachable and will be synced when it's back`,
        );
        setQuery("");
        invalidateSettings();
      },
      onError: (err: { message: string }) => toast.error(err.message),
    });

  const removeMutation =
    trpc.admin.servers.removeMaintenanceAllowedPlayer.useMutation({
      onSuccess: ({ username }) => {
        toast.success(`${username} removed from the allow list`);
        invalidateSettings();
      },
      onError: (err: { message: string }) => toast.error(err.message),
    });

  const pushMutation = trpc.admin.servers.pushMaintenanceSettings.useMutation({
    onSuccess: ({ added, removed }) => {
      toast.success(
        `Settings pushed to the server (+${added.length} / -${removed.length} allowed players)`,
      );
      utils.admin.servers.maintenanceStatus.invalidate({ serverId });
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  const allowedUuids = new Set(settings.allowedPlayers.map((p) => p.uuid));
  const results = (searchQuery.data?.players ?? []).filter(
    (p) => !allowedUuids.has(p.minecraftUuid),
  );

  const motdValue = motd.trim();
  const messageValue = message.trim();
  const canSave =
    motdValue.length > 0 &&
    messageValue.length > 0 &&
    (motdValue !== (settings.motd ?? settings.presets.motd) ||
      messageValue !== (settings.message ?? settings.presets.message));

  function handleSave() {
    saveMutation.mutate({
      serverId,
      motd: motdValue === settings.presets.motd ? null : motdValue,
      message: messageValue === settings.presets.message ? null : messageValue,
    });
  }

  return (
    <>
      <div className="space-y-6">
        <TemplateField
          id="maintenance-motd"
          label="Server list MOTD"
          hint="Minecraft color codes (&6 gold, &c red, &l bold, &r reset), one line per server-list line. Tokens: {server}, {eta}."
          value={motd}
          preset={settings.presets.motd}
          maxLength={MOTD_MAX_LENGTH}
          rows={3}
          onChange={setMotd}
        />

        <TemplateField
          id="maintenance-message"
          label="Kick message"
          hint="Shown to players who are not allowed in. Same formatting and tokens."
          value={message}
          preset={settings.presets.message}
          maxLength={MESSAGE_MAX_LENGTH}
          rows={4}
          onChange={setMessage}
        />

        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={!canSave}
            loading={saveMutation.isPending}
          >
            Save messages
          </Button>
        </div>

        <Separator />

        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">Allowed players</p>
            <p className="text-xs text-muted-foreground">
              Admins are always allowed. Everyone else is kicked when
              maintenance starts and can&apos;t join until it ends.
            </p>
          </div>

          <div className="divide-y divide-border rounded-md border border-border">
            {settings.allowedPlayers.length === 0 && (
              <p className="p-3 text-center text-sm text-muted-foreground">
                No allowed players yet.
              </p>
            )}
            {settings.allowedPlayers.map((player) => (
              <div
                key={player.uuid}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <PlayerLabel uuid={player.uuid} name={player.username} />
                {player.source === "admin" ? (
                  <Badge variant="outline">Admin</Badge>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    aria-label={`Remove ${player.username}`}
                    disabled={removeMutation.isPending}
                    onClick={() =>
                      removeMutation.mutate({
                        serverId,
                        playerUuid: player.uuid,
                      })
                    }
                  >
                    <X className="size-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Add a player by Minecraft username"
              className="pl-9"
            />
            {debouncedQuery.trim().length > 0 && (
              <div className="mt-2 max-h-48 overflow-y-auto rounded-md border border-border">
                {searchQuery.isLoading ? (
                  <div className="p-3 text-center text-sm text-muted-foreground">
                    Searching…
                  </div>
                ) : results.length === 0 ? (
                  <div className="p-3 text-center text-sm text-muted-foreground">
                    No matching players.
                  </div>
                ) : (
                  results.map((p) => (
                    <button
                      key={p.minecraftUuid}
                      type="button"
                      disabled={addMutation.isPending}
                      onClick={() =>
                        addMutation.mutate({
                          serverId,
                          playerUuid: p.minecraftUuid,
                        })
                      }
                      className="flex w-full items-center gap-2 border-b border-border px-3 py-2 text-left last:border-b-0 hover:bg-muted/50 disabled:opacity-50"
                    >
                      <MinecraftAvatar
                        username={p.minecraftUsername}
                        uuid={p.minecraftUuid}
                        size={24}
                      />
                      <span className="text-sm font-medium">
                        {p.minecraftUsername}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <DialogFooter className="sm:justify-between">
        <Button
          variant="outline"
          size="sm"
          loading={pushMutation.isPending}
          onClick={() => pushMutation.mutate({ serverId })}
        >
          <RefreshCw className="mr-1.5 size-3.5" />
          Push to server
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </DialogFooter>
    </>
  );
}
