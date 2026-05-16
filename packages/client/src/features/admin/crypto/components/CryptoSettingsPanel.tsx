import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";
import { Loading } from "@/components/loading-spinner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { LabeledSwitch } from "@/components/labeled-switch";
import { useStickyValue } from "@/hooks/use-sticky-value";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RotateCcw, Power } from "lucide-react";
import { cn } from "@/lib/utils";

import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@createrington/server/trpc";

type SettingEntry =
  inferRouterOutputs<AppRouter>["admin"]["crypto"]["settings"]["list"][number];
type SettingKey = SettingEntry["key"];

const GROUP_ORDER: Array<{ id: string; title: string; description: string }> = [
  {
    id: "generation",
    title: "Memecoin generation",
    description:
      "Active cap, IPO spawn cadence, starting price and supply ranges, crash cleanup.",
  },
  {
    id: "tick",
    title: "Price tick intervals",
    description: "How often each category recomputes prices.",
  },
  {
    id: "trading",
    title: "Trading limits",
    description: "Cooldowns and order limits applied to player trades.",
  },
  {
    id: "fees",
    title: "Fees",
    description: "Fractional trading fees per category and the burn ratio.",
  },
  {
    id: "events",
    title: "Market events",
    description: "Random event roll cadence and concurrency.",
  },
  {
    id: "social",
    title: "Watchlists & alerts",
    description: "Per-player social/engagement caps.",
  },
  {
    id: "ipo",
    title: "IPO",
    description: "IPO window and per-player allocation cap.",
  },
];

function formatValue(value: unknown): string {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (value === null || value === undefined) return "—";
  return String(value);
}

function parseInputValue(
  raw: string,
  defaultValue: unknown,
): { ok: true; value: unknown } | { ok: false; error: string } {
  if (typeof defaultValue === "boolean") {
    if (raw === "true") return { ok: true, value: true };
    if (raw === "false") return { ok: true, value: false };
    return { ok: false, error: "Expected true or false" };
  }
  if (typeof defaultValue === "number") {
    const n = Number(raw);
    if (Number.isNaN(n)) return { ok: false, error: "Not a valid number" };
    return { ok: true, value: n };
  }
  return { ok: true, value: raw };
}

function SettingRow({
  entry,
  onSave,
  onReset,
  pending,
}: {
  entry: SettingEntry;
  onSave: (key: SettingKey, value: unknown) => void;
  onReset: (key: SettingKey) => void;
  pending: boolean;
}) {
  const [draft, setDraft] = useState<string>(formatValue(entry.currentValue));
  const [error, setError] = useState<string | null>(null);

  const dirty = draft !== formatValue(entry.currentValue);

  function handleSave() {
    const parsed = parseInputValue(draft, entry.defaultValue);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError(null);
    onSave(entry.key, parsed.value);
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr_auto] items-start gap-3 py-3 border-b border-border last:border-b-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium">{entry.label}</Label>
          {entry.isOverridden && (
            <Badge variant="outline" className="text-xs">
              overridden
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground font-mono">{entry.key}</p>
        {entry.description && (
          <p className="text-xs text-muted-foreground mt-1">
            {entry.description}
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          default:{" "}
          <span className="font-mono">{formatValue(entry.defaultValue)}</span>
        </p>
      </div>
      <div className="flex flex-col gap-1">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className={cn("h-8 font-mono text-sm", error && "border-destructive")}
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
      <div className="flex items-center gap-2 justify-end">
        <Button
          size="sm"
          variant="default"
          disabled={!dirty || pending}
          onClick={handleSave}
        >
          Save
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={!entry.isOverridden || pending}
          onClick={() => onReset(entry.key)}
          title="Reset to default"
        >
          <RotateCcw className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

function MasterToggleCard({
  entry,
  onSave,
  pending,
}: {
  entry: SettingEntry;
  onSave: (key: SettingKey, value: unknown) => void;
  pending: boolean;
}) {
  const enabled = entry.currentValue === true;
  const [pendingValue, setPendingValue] = useState<boolean | null>(null);
  const stickyPending = useStickyValue(pendingValue);
  const isTurningOff = stickyPending === false;

  return (
    <>
      <Card
        className={cn(
          "border-2",
          enabled ? "border-primary/30" : "border-destructive/40",
        )}
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Power
              className={cn(
                "size-5",
                enabled ? "text-primary" : "text-destructive",
              )}
            />
            Crypto market {enabled ? "enabled" : "disabled"}
          </CardTitle>
          <CardDescription>{entry.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <LabeledSwitch
            id="crypto-master-toggle"
            checked={enabled}
            disabled={pending}
            onCheckedChange={(checked) => setPendingValue(checked)}
            label={
              enabled
                ? "Tickers running, trades allowed"
                : "Tickers paused, trades blocked"
            }
            className="w-fit"
          />
        </CardContent>
      </Card>

      <Dialog
        open={pendingValue !== null}
        onOpenChange={(open) => {
          if (!open) setPendingValue(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isTurningOff
                ? "Disable the crypto market?"
                : "Re-enable the crypto market?"}
            </DialogTitle>
            <DialogDescription>
              {isTurningOff
                ? "Pausing the market affects every player. Review the consequences before confirming."
                : "The market resumes immediately on the next tick interval."}
            </DialogDescription>
          </DialogHeader>
          <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
            {isTurningOff ? (
              <>
                <li>
                  All price tickers (memecoin, stablecoin, blue-chip) pause; no
                  new candles or snapshots are recorded.
                </li>
                <li>
                  Memecoin generation, IPO spawning, and random market events
                  are skipped.
                </li>
                <li>
                  Player trade mutations (buy, sell, place order) are blocked
                  with a Forbidden response. Cancelling pending orders still
                  works.
                </li>
                <li>
                  Non-admin players visiting <code>/crypto</code> see a
                  &ldquo;temporarily disabled&rdquo; screen instead of the
                  market.
                </li>
                <li>
                  Existing balances, holdings, and pending orders stay intact:
                  nothing is wiped.
                </li>
              </>
            ) : (
              <>
                <li>
                  Restarts all tickers, generation, IPO spawning, and event
                  rolls on their configured intervals.
                </li>
                <li>
                  Re-opens trading. The first memecoin tick fires within one
                  tick interval (default 30 seconds).
                </li>
                <li>
                  Players regain access to the crypto pages on the next status
                  refresh (within 30 seconds).
                </li>
              </>
            )}
          </ul>
          <p className="text-xs text-muted-foreground">
            The change is audit-logged.
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              variant={isTurningOff ? "destructive" : "default"}
              onClick={() => {
                if (pendingValue !== null) onSave(entry.key, pendingValue);
                setPendingValue(null);
              }}
            >
              {isTurningOff ? "Disable market" : "Re-enable market"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function CryptoSettingsPanel() {
  const toast = useToastActions();
  const utils = trpc.useUtils();
  const listQuery = trpc.admin.crypto.settings.list.useQuery();

  const updateMutation = trpc.admin.crypto.settings.update.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.key} updated`);
      utils.admin.crypto.settings.list.invalidate();
      utils.public.crypto.status.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const resetMutation = trpc.admin.crypto.settings.reset.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.key} reset to default`);
      utils.admin.crypto.settings.list.invalidate();
      utils.public.crypto.status.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const resetAllMutation = trpc.admin.crypto.settings.resetAll.useMutation({
    onSuccess: (data) => {
      toast.success(`Reset ${data.cleared} settings`);
      utils.admin.crypto.settings.list.invalidate();
      utils.public.crypto.status.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const pending =
    updateMutation.isPending ||
    resetMutation.isPending ||
    resetAllMutation.isPending;

  const grouped = useMemo(() => {
    const map = new Map<string, SettingEntry[]>();
    for (const entry of listQuery.data ?? []) {
      if (!map.has(entry.group)) map.set(entry.group, []);
      map.get(entry.group)!.push(entry);
    }
    return map;
  }, [listQuery.data]);

  if (listQuery.isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-12">
        <Loading size="medium" text="Loading settings..." />
      </div>
    );
  }

  const master = (listQuery.data ?? []).find((e) => e.key === "cryptoEnabled");

  return (
    <div className="flex flex-col gap-4">
      {master && (
        <MasterToggleCard
          entry={master}
          onSave={(key, value) => updateMutation.mutate({ key, value })}
          pending={pending}
        />
      )}

      {GROUP_ORDER.map((group) => {
        const entries = grouped.get(group.id) ?? [];
        if (entries.length === 0) return null;
        return (
          <Card key={group.id}>
            <CardHeader>
              <CardTitle className="text-sm">{group.title}</CardTitle>
              <CardDescription>{group.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col">
                {entries.map((entry) => (
                  <SettingRow
                    key={entry.key}
                    entry={entry}
                    onSave={(key, value) =>
                      updateMutation.mutate({ key, value })
                    }
                    onReset={(key) => resetMutation.mutate({ key })}
                    pending={pending}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-base text-destructive">
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Reset all overrides</p>
              <p className="text-xs text-muted-foreground">
                Removes every override row so every setting falls back to its
                compiled default. The action is audit-logged.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="shrink-0">
                  Reset all
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Reset all crypto settings?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This removes every override and restores the compiled
                    defaults. The action is audit-logged.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => resetAllMutation.mutate({ confirm: true })}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Reset all
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
