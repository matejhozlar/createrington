import { useMemo, useState } from "react";
import { Loading } from "@/components/loading-spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import {
  BarChart3,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

interface StatsTabProps {
  playerId: string;
  getServerName: (serverId: number) => string | null;
}

interface FlatStat {
  category: string;
  key: string;
  value: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  "minecraft:mined": "Blocks Mined",
  "minecraft:broken": "Items Broken",
  "minecraft:crafted": "Items Crafted",
  "minecraft:used": "Items Used",
  "minecraft:picked_up": "Items Picked Up",
  "minecraft:dropped": "Items Dropped",
  "minecraft:killed": "Mobs Killed",
  "minecraft:killed_by": "Killed By",
  "minecraft:custom": "General",
};

function formatStatName(key: string): string {
  return key
    .replace(/^minecraft:/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatCategoryName(category: string): string {
  return CATEGORY_LABELS[category] ?? formatStatName(category);
}

function formatValue(value: number): string {
  return value.toLocaleString();
}

const STAT_COLUMNS: DataTableColumn<FlatStat>[] = [
  {
    key: "stat",
    header: "Stat",
    minWidth: 200,
    cellClassName: "text-sm",
    render: (stat) => formatStatName(stat.key),
  },
  {
    key: "value",
    header: "Value",
    width: 140,
    align: "right",
    render: (stat) => (
      <span className="font-semibold tabular-nums">
        {formatValue(stat.value)}
      </span>
    ),
  },
];

export function StatsTab({ playerId, getServerName }: StatsTabProps) {
  const [search, setSearch] = useState("");
  const [selectedServer, setSelectedServer] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(),
  );

  const debouncedSearch = useDebouncedValue(search, 300);

  const statsQuery = trpc.admin.players.minecraftStats.list.useQuery({
    id: playerId,
  });

  const statsEntries = useMemo(
    () => statsQuery.data?.stats ?? [],
    [statsQuery.data?.stats],
  );
  const loading = statsQuery.isLoading;
  const error = statsQuery.error?.message ?? null;

  const serverOptions = useMemo(() => {
    return statsEntries.map((entry) => ({
      id: entry.serverId,
      name: getServerName(entry.serverId) ?? `Server ${entry.serverId}`,
    }));
  }, [statsEntries, getServerName]);

  // Get the active stats entry (selected server or first available)
  const activeStats = useMemo(() => {
    if (statsEntries.length === 0) return null;
    if (selectedServer === "all") {
      // Merge stats from all servers
      const merged: Record<string, Record<string, number>> = {};
      for (const entry of statsEntries) {
        const stats = entry.stats;
        if (!stats || typeof stats !== "object") continue;
        for (const [category, items] of Object.entries(stats)) {
          if (!items || typeof items !== "object") continue;
          if (!merged[category]) merged[category] = {};
          for (const [key, value] of Object.entries(
            items as Record<string, number>,
          )) {
            merged[category][key] = (merged[category][key] ?? 0) + (value ?? 0);
          }
        }
      }
      return merged;
    }
    const entry = statsEntries.find(
      (e) => e.serverId === parseInt(selectedServer),
    );
    return (entry?.stats as Record<string, Record<string, number>>) ?? null;
  }, [statsEntries, selectedServer]);

  const { flatStats, categories } = useMemo(() => {
    if (!activeStats) return { flatStats: [], categories: [] };

    const cats = Object.keys(activeStats).sort((a, b) =>
      formatCategoryName(a).localeCompare(formatCategoryName(b)),
    );

    const flat: FlatStat[] = [];
    for (const category of cats) {
      const items = activeStats[category];
      if (!items) continue;
      for (const [key, value] of Object.entries(items)) {
        flat.push({ category, key, value });
      }
    }

    return { flatStats: flat, categories: cats };
  }, [activeStats]);

  // Apply search and category filters
  const filteredStats = useMemo(() => {
    let result = flatStats;

    if (selectedCategory !== "all") {
      result = result.filter((s) => s.category === selectedCategory);
    }

    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(
        (s) =>
          formatStatName(s.key).toLowerCase().includes(q) ||
          formatCategoryName(s.category).toLowerCase().includes(q),
      );
    }

    return result.sort((a, b) => b.value - a.value);
  }, [flatStats, selectedCategory, debouncedSearch]);

  const groupedStats = useMemo(() => {
    const groups: Record<string, FlatStat[]> = {};
    for (const stat of filteredStats) {
      if (!groups[stat.category]) groups[stat.category] = [];
      groups[stat.category].push(stat);
    }
    return groups;
  }, [filteredStats]);

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedCategories(new Set(Object.keys(groupedStats)));
  };

  const collapseAll = () => {
    setExpandedCategories(new Set());
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Minecraft Stats</h3>
          <p className="text-sm text-muted-foreground">
            {filteredStats.length.toLocaleString()} stats
            {debouncedSearch || selectedCategory !== "all"
              ? ` (filtered from ${flatStats.length.toLocaleString()})`
              : ""}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => statsQuery.refetch()}
          disabled={loading}
        >
          <RefreshCw className={cn("size-4", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loading size="medium" text="Loading stats..." />
        </div>
      ) : error ? (
        <div className="py-12 text-center">
          <p className="text-destructive">{error}</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => statsQuery.refetch()}
            className="mt-4"
          >
            Retry
          </Button>
        </div>
      ) : statsEntries.length === 0 ? (
        <div className="py-12 text-center">
          <BarChart3 className="mx-auto size-12 text-muted-foreground" />
          <p className="mt-2 text-muted-foreground">
            No stats recorded for this player
          </p>
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-48 flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search stats..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            {serverOptions.length > 1 && (
              <Select value={selectedServer} onValueChange={setSelectedServer}>
                <SelectTrigger className="min-w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Servers</SelectItem>
                  {serverOptions.map((s) => (
                    <SelectItem key={s.id} value={s.id.toString()}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select
              value={selectedCategory}
              onValueChange={setSelectedCategory}
            >
              <SelectTrigger className="min-w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {formatCategoryName(cat)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={expandAll}
                className="text-xs"
              >
                Expand All
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={collapseAll}
                className="text-xs"
              >
                Collapse All
              </Button>
            </div>
          </div>

          {/* Stats grouped by category */}
          {Object.keys(groupedStats).length === 0 ? (
            <div className="py-12 text-center">
              <Search className="mx-auto size-12 text-muted-foreground" />
              <p className="mt-2 text-muted-foreground">
                No stats match your search
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {Object.entries(groupedStats)
                .sort(([a], [b]) =>
                  formatCategoryName(a).localeCompare(formatCategoryName(b)),
                )
                .map(([category, stats]) => {
                  const isExpanded = expandedCategories.has(category);
                  const totalValue = stats.reduce((sum, s) => sum + s.value, 0);

                  return (
                    <div
                      key={category}
                      className="overflow-hidden rounded-lg border border-border"
                    >
                      {/* Category header */}
                      <button
                        type="button"
                        onClick={() => toggleCategory(category)}
                        className="flex w-full cursor-pointer items-center justify-between px-4 py-3 transition-colors hover:bg-sidebar-accent/30"
                      >
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronDown className="size-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="size-4 text-muted-foreground" />
                          )}
                          <span className="font-medium">
                            {formatCategoryName(category)}
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            {stats.length}
                          </Badge>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {formatValue(totalValue)} total
                        </span>
                      </button>

                      {/* Category stats table */}
                      {isExpanded && (
                        <DataTable
                          columns={STAT_COLUMNS}
                          rows={stats}
                          rowKey={(stat) => stat.key}
                        />
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
