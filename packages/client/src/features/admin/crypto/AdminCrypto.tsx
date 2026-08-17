import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";
import { Loading } from "@/components/loading-spinner";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { CellText } from "@/components/cell-text";
import {
  DataTable,
  type DataTableAction,
  type DataTableColumn,
} from "@/components/data-table";
import { useStickyValue } from "@/hooks/use-sticky-value";
import {
  Coins,
  TrendingUp,
  Zap,
  Wallet,
  Flame,
  BarChart3,
  Plus,
  Trash2,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CryptoSettingsPanel } from "./components/CryptoSettingsPanel";

const CATEGORY_OPTIONS = [
  { value: "memecoin", label: "Memecoin" },
  { value: "seasonal", label: "Seasonal" },
] as const;

const CATEGORY_COLORS: Record<string, string> = {
  stable: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  blue_chip: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  memecoin: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  seasonal: "bg-purple-500/10 text-purple-400 border-purple-500/20",
};

const EVENT_TYPES = [
  {
    value: "bull_run",
    label: "Bull Run",
    severity: "info",
    description: "+20% volatility, upward price bias for 1-2h",
  },
  {
    value: "bear_market",
    label: "Bear Market",
    severity: "warning",
    description: "+20% volatility, downward price pressure for 1-2h",
  },
  {
    value: "flash_crash",
    label: "Flash Crash",
    severity: "critical",
    description: "Instant ~18% price drop on a random memecoin",
  },
  {
    value: "pump_and_dump",
    label: "Pump & Dump",
    severity: "warning",
    description: "2h event: pumps a token first half, dumps second half",
  },
  {
    value: "liquidity_drought",
    label: "Liquidity Drought",
    severity: "warning",
    description: "2x trading fees for 30min-2h",
  },
  {
    value: "gold_rush",
    label: "Gold Rush",
    severity: "info",
    description: "2x stablecoin inflation rate for 1-2h",
  },
  {
    value: "supply_shock",
    label: "Supply Shock",
    severity: "warning",
    description: "Instantly burns ~15% of a memecoin's available supply",
  },
  {
    value: "tax_holiday",
    label: "Tax Holiday",
    severity: "info",
    description: "50% off trading fees for 30min-1h",
  },
  {
    value: "whale_dump",
    label: "Whale Dump",
    severity: "warning",
    description: "Instant ~10% price drop on a random memecoin",
  },
  {
    value: "new_listing_frenzy",
    label: "New Listing Frenzy",
    severity: "info",
    description: "+10% memecoin volatility for 1h",
  },
] as const;

const SEVERITY_COLORS: Record<string, string> = {
  info: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  warning: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  critical: "bg-destructive/10 text-destructive border-destructive/20",
};

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between">
        <div>
          <CardDescription>{label}</CardDescription>
          <CardTitle className="text-2xl">{value}</CardTitle>
        </div>
        <div className="rounded-lg bg-muted p-2">
          <Icon className="size-5 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}

function CreateTokenDialog() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<"memecoin" | "seasonal">("memecoin");
  const [selectedSymbol, setSelectedSymbol] = useState("");
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [totalSupply, setTotalSupply] = useState("10000");
  const [price, setPrice] = useState("1.00");
  const [floorPrice, setFloorPrice] = useState("");
  const toast = useToastActions();
  const utils = trpc.useUtils();

  const catalogQuery = trpc.admin.crypto.availableMemecoins.useQuery(
    undefined,
    { enabled: open },
  );
  const catalog = catalogQuery.data ?? [];

  const createMutation = trpc.admin.crypto.createToken.useMutation({
    onSuccess: (data) => {
      toast.success(`Created ${data.token.symbol}`);
      utils.admin.crypto.marketStats.invalidate();
      utils.admin.crypto.availableMemecoins.invalidate();
      utils.public.crypto.list.invalidate();
      setOpen(false);
      resetForm();
    },
    onError: (err) => toast.error(err.message),
  });

  function resetForm() {
    setCategory("memecoin");
    setSelectedSymbol("");
    setName("");
    setSymbol("");
    setDescription("");
    setTotalSupply("10000");
    setPrice("1.00");
    setFloorPrice("");
  }

  function handleCatalogSelect(sym: string) {
    setSelectedSymbol(sym);
    const entry = catalog.find((m) => m.symbol === sym);
    if (entry) {
      setName(entry.name);
      setSymbol(entry.symbol);
      setDescription(entry.description);
    }
  }

  function handleCreate() {
    createMutation.mutate({
      name,
      symbol,
      description: description || undefined,
      category,
      totalSupply: Number(totalSupply),
      price: Number(price),
      floorPrice: floorPrice ? Number(floorPrice) : undefined,
    });
  }

  const isValid =
    name.length > 0 &&
    symbol.length > 0 &&
    Number(price) > 0 &&
    Number(totalSupply) > 0;

  const isMemecoin = category === "memecoin";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="size-3.5" />
          Create Token
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Token</DialogTitle>
          <DialogDescription>
            {isMemecoin
              ? "Pick a memecoin from the catalog."
              : "Create a seasonal token."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select
              value={category}
              onValueChange={(v) => {
                setCategory(v as "memecoin" | "seasonal");
                setSelectedSymbol("");
                setName("");
                setSymbol("");
                setDescription("");
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isMemecoin ? (
            <div className="space-y-1.5">
              <Label>Memecoin</Label>
              <Select
                value={selectedSymbol}
                onValueChange={handleCatalogSelect}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a memecoin..." />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {catalog.map((m) => (
                    <SelectItem key={m.symbol} value={m.symbol}>
                      {m.name}{" "}
                      <span className="text-muted-foreground">
                        ({m.symbol})
                      </span>
                    </SelectItem>
                  ))}
                  {catalog.length === 0 && (
                    <p className="px-2 py-1.5 text-sm text-muted-foreground">
                      {catalogQuery.isLoading
                        ? "Loading..."
                        : "No available memecoins"}
                    </p>
                  )}
                </SelectContent>
              </Select>
              {selectedSymbol && (
                <p className="text-xs text-muted-foreground">{description}</p>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="token-name">Name</Label>
                  <Input
                    id="token-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Spring Token"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="token-symbol">Symbol</Label>
                  <Input
                    id="token-symbol"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    placeholder="SPR"
                    maxLength={10}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="token-description">Description</Label>
                <Input
                  id="token-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description..."
                />
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="token-supply">Total Supply</Label>
              <Input
                id="token-supply"
                type="number"
                value={totalSupply}
                onChange={(e) => setTotalSupply(e.target.value)}
                min={1}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="token-price">Starting Price ($)</Label>
              <Input
                id="token-price"
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                min={0}
                step="0.01"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="token-floor">Floor Price ($)</Label>
            <Input
              id="token-floor"
              type="number"
              value={floorPrice}
              onChange={(e) => setFloorPrice(e.target.value)}
              min={0}
              step="0.01"
              placeholder="Optional"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={handleCreate}
            disabled={!isValid || createMutation.isPending}
          >
            {createMutation.isPending ? "Creating..." : "Create Token"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TriggerEventDialog({
  tokens,
}: {
  tokens: { id: number; symbol: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [eventType, setEventType] = useState<string>(EVENT_TYPES[0].value);
  const [tokenId, setTokenId] = useState<string>("");
  const toast = useToastActions();
  const utils = trpc.useUtils();

  const triggerMutation = trpc.admin.crypto.triggerEvent.useMutation({
    onSuccess: (data) => {
      if (data.success && "event" in data) {
        toast.success(
          `Triggered ${eventType.replace(/_/g, " ")}${data.event?.tokenSymbol ? ` on ${data.event.tokenSymbol}` : ""}`,
        );
        utils.admin.crypto.activeEvents.invalidate();
        utils.public.crypto.activeEvents.invalidate();
      } else if ("message" in data) {
        toast.warning(data.message ?? "Event could not be triggered");
      }
      setOpen(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const selectedDef = EVENT_TYPES.find((e) => e.value === eventType) as
    | { value: string; label: string; severity: string; description: string }
    | undefined;
  const isTokenScoped = [
    "flash_crash",
    "pump_and_dump",
    "supply_shock",
    "whale_dump",
  ].includes(eventType);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Zap className="size-3.5" />
          Trigger Event
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Trigger Market Event</DialogTitle>
          <DialogDescription>
            Manually fire a market event. Active events of the same type will be
            replaced.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-1.5">
            <Label>Event Type</Label>
            <Select
              value={eventType}
              onValueChange={(v) => {
                setEventType(v);
                setTokenId("");
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map((e) => (
                  <SelectItem key={e.value} value={e.value}>
                    <span className="flex items-center gap-2">
                      {e.label}
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] px-1.5 py-0",
                          SEVERITY_COLORS[e.severity],
                        )}
                      >
                        {e.severity}
                      </Badge>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isTokenScoped && (
            <div className="space-y-1.5">
              <Label>
                Target Token{" "}
                <span className="text-muted-foreground text-xs">
                  (optional — random if empty)
                </span>
              </Label>
              <Select value={tokenId} onValueChange={setTokenId}>
                <SelectTrigger>
                  <SelectValue placeholder="Random target" />
                </SelectTrigger>
                <SelectContent>
                  {tokens.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.symbol} — {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {selectedDef && (
            <p className="text-xs text-muted-foreground">
              {selectedDef.description}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            onClick={() =>
              triggerMutation.mutate({
                eventType: eventType as (typeof EVENT_TYPES)[number]["value"],
                tokenId: tokenId ? Number(tokenId) : undefined,
              })
            }
            disabled={triggerMutation.isPending}
          >
            {triggerMutation.isPending ? "Triggering..." : "Trigger Event"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DelistDialog({
  target,
  onClose,
  onDelisted,
}: {
  target: { id: number; symbol: string } | null;
  onClose: () => void;
  onDelisted: () => void;
}) {
  const toast = useToastActions();
  const displayTarget = useStickyValue(target);
  const delistMutation = trpc.admin.crypto.delistToken.useMutation({
    onSuccess: onDelisted,
    onError: (err) => toast.error(err.message),
  });

  return (
    <ConfirmDialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      size="sm"
      title={<>Delist {displayTarget?.symbol}</>}
      description="All holdings will be auto-sold at current price. This action cannot be undone."
      confirmLabel="Delist"
      variant="destructive"
      onConfirm={() =>
        target ? delistMutation.mutateAsync({ id: target.id }) : undefined
      }
    />
  );
}

export function AdminCrypto() {
  const toast = useToastActions();
  const utils = trpc.useUtils();

  const statsQuery = trpc.admin.crypto.marketStats.useQuery();
  const treasuryQuery = trpc.admin.crypto.treasury.useQuery();
  const activeEventsQuery = trpc.admin.crypto.activeEvents.useQuery(undefined, {
    refetchInterval: 30_000,
  });
  const tokensQuery = trpc.public.crypto.list.useQuery({
    includesCrashed: true,
  });

  const onTokenDelisted = () => {
    toast.success("Token delisted");
    utils.public.crypto.list.invalidate();
    utils.admin.crypto.marketStats.invalidate();
  };

  const stats = statsQuery.data;
  const treasury = treasuryQuery.data;
  const activeEvents = activeEventsQuery.data ?? [];
  const tokens = tokensQuery.data ?? [];

  const [delistTarget, setDelistTarget] = useState<{
    id: number;
    symbol: string;
  } | null>(null);

  type Token = (typeof tokens)[number];

  const tokenColumns: DataTableColumn<Token>[] = [
    {
      key: "token",
      header: "Token",
      minWidth: 160,
      render: (token) => (
        <>
          <CellText value={token.name} className="font-medium" />
          <CellText
            value={token.symbol}
            className="font-mono text-xs text-muted-foreground"
          />
        </>
      ),
    },
    {
      key: "category",
      header: "Category",
      width: 140,
      render: (token) => (
        <Badge
          variant="outline"
          className={cn("text-xs", CATEGORY_COLORS[token.category])}
        >
          {token.category.replace("_", " ")}
        </Badge>
      ),
    },
    {
      key: "price",
      header: "Price",
      width: 140,
      align: "right",
      cellClassName: "font-mono tabular-nums",
      render: (token) =>
        `$${Number(token.price).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 6,
        })}`,
    },
    {
      key: "supply",
      header: "Supply",
      width: 140,
      align: "right",
      render: (token) => {
        const held = Number(token.totalSupply) - Number(token.availableSupply);
        const heldPct =
          Number(token.totalSupply) > 0
            ? ((held / Number(token.totalSupply)) * 100).toFixed(1)
            : "0";
        return (
          <>
            <p className="font-mono text-sm tabular-nums">
              {held.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">{heldPct}% held</p>
          </>
        );
      },
    },
    {
      key: "change24h",
      header: "24h",
      width: 100,
      align: "right",
      render: (token) =>
        token.change24h !== undefined &&
        token.change24h !== 0 && (
          <span
            className={cn(
              "font-mono text-sm tabular-nums",
              token.change24h > 0 ? "text-emerald-400" : "text-destructive",
            )}
          >
            {token.change24h > 0 ? "+" : ""}
            {token.change24h.toFixed(2)}%
          </span>
        ),
    },
    {
      key: "status",
      header: "Status",
      width: 110,
      render: (token) =>
        token.isCrashed ? (
          <Badge variant="destructive" className="text-xs">
            Crashed
          </Badge>
        ) : token.delistedAt ? (
          <Badge variant="secondary" className="text-xs">
            Delisted
          </Badge>
        ) : token.ipoEndsAt && new Date(token.ipoEndsAt) > new Date() ? (
          <Badge
            variant="outline"
            className="text-xs text-primary border-primary/30 bg-primary/10"
          >
            IPO
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="text-xs text-emerald-400 border-emerald-500/20 bg-emerald-500/10"
          >
            Active
          </Badge>
        ),
    },
  ];

  const tokenActions = (token: Token): DataTableAction[] =>
    !token.isCrashed && !token.delistedAt
      ? [
          {
            label: "Delist",
            icon: Trash2,
            variant: "destructive",
            onClick: () =>
              setDelistTarget({ id: token.id, symbol: token.symbol }),
          },
        ]
      : [];

  const isLoading = statsQuery.isLoading || tokensQuery.isLoading;

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-4">
        <AdminPageHeader
          trail={[
            { label: "Admin", href: "/admin/dashboard" },
            { label: "Tools", href: "/admin/tools" },
            { label: "Crypto" },
          ]}
        />
        <div className="flex flex-1 items-center justify-center">
          <Loading size="medium" text="Loading market data..." />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <AdminPageHeader
        trail={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Tools", href: "/admin/tools" },
          { label: "Crypto" },
        ]}
      >
        <TriggerEventDialog
          tokens={tokens
            .filter((t) => !t.isCrashed && !t.delistedAt)
            .map((t) => ({ id: t.id, symbol: t.symbol, name: t.name }))}
        />
        <CreateTokenDialog />
      </AdminPageHeader>

      <div className="mx-auto w-full max-w-[1400px] flex flex-1 flex-col gap-4 px-4 pb-4">
        <Tabs defaultValue="market" className="flex flex-col gap-4">
          <TabsList>
            <TabsTrigger value="market">Market</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="market" className="flex flex-col gap-4">
            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Active Tokens"
                value={stats?.activeTokens ?? 0}
                icon={Coins}
              />
              <StatCard
                label="Total Market Cap"
                value={`$${Number(stats?.totalMarketCap ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                icon={TrendingUp}
              />
              <StatCard
                label="24h Volume"
                value={`$${Number(stats?.dailyVolume ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                icon={BarChart3}
              />
              <StatCard
                label="24h Traders"
                value={stats?.uniqueTraders24h ?? 0}
                icon={Wallet}
              />
            </div>

            {/* Treasury + Active Events row */}
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Treasury */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Wallet className="size-4 text-muted-foreground" />
                    Treasury
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">
                        Fees Collected
                      </p>
                      <p className="text-xl font-bold font-mono tabular-nums mt-0.5">
                        $
                        {Number(treasury?.totalCollected ?? 0).toLocaleString(
                          undefined,
                          { maximumFractionDigits: 2 },
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">
                        Fees Burned
                      </p>
                      <p className="text-xl font-bold font-mono tabular-nums mt-0.5 flex items-center gap-1.5">
                        <Flame className="size-4 text-orange-400" />$
                        {Number(treasury?.totalBurned ?? 0).toLocaleString(
                          undefined,
                          { maximumFractionDigits: 2 },
                        )}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Active Events */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Zap className="size-4 text-muted-foreground" />
                    Active Events
                    {activeEvents.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {activeEvents.length}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {activeEvents.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No active events
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {activeEvents.map((event) => (
                        <div
                          key={event.id}
                          className="flex items-center justify-between rounded-lg border px-3 py-2"
                        >
                          <div className="flex items-center gap-2">
                            <Zap className="size-3.5 text-amber-400" />
                            <span className="text-sm font-medium">
                              {event.type.replace(/_/g, " ")}
                            </span>
                            {event.tokenSymbol && (
                              <Badge
                                variant="outline"
                                className="text-xs font-mono"
                              >
                                {event.tokenSymbol}
                              </Badge>
                            )}
                          </div>
                          {event.activeUntil && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="size-3" />
                              {new Date(event.activeUntil).toLocaleTimeString()}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Token List */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Coins className="size-4 text-muted-foreground" />
                  All Tokens
                  <Badge variant="secondary" className="text-xs">
                    {tokens.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <DataTable
                  columns={tokenColumns}
                  rows={tokens}
                  rowKey={(token) => token.id}
                  actions={tokenActions}
                  actionSlots={1}
                  rowClassName={(token) =>
                    token.isCrashed || token.delistedAt
                      ? "opacity-50"
                      : undefined
                  }
                />
              </CardContent>
            </Card>

            <DelistDialog
              target={delistTarget}
              onClose={() => setDelistTarget(null)}
              onDelisted={() => {
                onTokenDelisted();
                setDelistTarget(null);
              }}
            />

            {/* Extra stats row */}
            <div className="grid gap-4 md:grid-cols-3">
              <StatCard
                label="Total Trades"
                value={(stats?.totalTrades ?? 0).toLocaleString()}
                icon={BarChart3}
              />
              <StatCard
                label="24h Trades"
                value={stats?.dailyTrades ?? 0}
                icon={TrendingUp}
              />
              <StatCard
                label="Crashed Tokens"
                value={stats?.crashedTokens ?? 0}
                icon={Flame}
              />
            </div>
          </TabsContent>
          <TabsContent value="settings">
            <CryptoSettingsPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
