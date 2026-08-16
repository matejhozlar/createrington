import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CellText } from "@/components/cell-text";
import {
  AvatarCellSkeleton,
  DataTable,
  type DataTableColumn,
} from "@/components/data-table";
import { BarChart3, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { MinecraftAvatar } from "@/components/minecraft-avatar";
import { useNavigate } from "react-router";

const CATEGORY_OPTIONS = [
  { key: "minecraft:picked_up", label: "Picked Up" },
  { key: "minecraft:crafted", label: "Crafted" },
  { key: "minecraft:mined", label: "Mined" },
  { key: "minecraft:used", label: "Used" },
  { key: "minecraft:dropped", label: "Dropped" },
  { key: "minecraft:broken", label: "Broken" },
  { key: "minecraft:killed", label: "Killed" },
  { key: "minecraft:killed_by", label: "Killed By" },
  { key: "minecraft:custom", label: "General" },
] as const;

/** Minimum total count before a zero-in-one-category row is highlighted */
const SUSPICIOUS_THRESHOLD = 10;

function formatStatName(key: string): string {
  return key
    .replace(/^minecraft:/, "")
    .replace(/^[^:]+:/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function StatSearch() {
  const navigate = useNavigate();

  const [itemInput, setItemInput] = useState("");
  const [selectedItem, setSelectedItem] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debouncedItemInput = useDebouncedValue(itemInput, 300);

  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
    new Set(["minecraft:picked_up", "minecraft:crafted"]),
  );

  const itemsQuery = trpc.admin.players.minecraftStats.searchItems.useQuery(
    { query: debouncedItemInput },
    { enabled: debouncedItemInput.length >= 2 },
  );

  const categories = useMemo(
    () => Array.from(selectedCategories),
    [selectedCategories],
  );

  const compareQuery = trpc.admin.players.minecraftStats.compare.useQuery(
    { item: selectedItem, categories, limit: 200 },
    { enabled: !!selectedItem && categories.length > 0 },
  );

  const toggleCategory = (key: string) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleSelectItem = (item: string) => {
    setSelectedItem(item);
    setItemInput(item);
    setShowSuggestions(false);
  };

  const handleClearItem = () => {
    setItemInput("");
    setSelectedItem("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (itemInput.trim()) {
      setSelectedItem(itemInput.trim());
      setShowSuggestions(false);
    }
  };

  const results = compareQuery.data ?? [];
  const categoryLabels = categories.map(
    (c) => CATEGORY_OPTIONS.find((o) => o.key === c)?.label ?? c,
  );

  type StatResult = (typeof results)[number];

  const isSuspicious = (result: StatResult) => {
    const max = Math.max(...result.values);
    const min = Math.min(...result.values);
    return categories.length >= 2 && max > 0 && min === 0;
  };

  const columns: DataTableColumn<StatResult>[] = [
    {
      key: "rank",
      header: "#",
      width: 60,
      align: "center",
      cellClassName: "text-sm text-muted-foreground",
      render: (_result, index) => index + 1,
    },
    {
      key: "player",
      header: "Player",
      minWidth: 200,
      skeleton: () => <AvatarCellSkeleton />,
      render: (result) => (
        <div className="flex min-w-0 items-center gap-3">
          <MinecraftAvatar
            uuid={result.minecraftUuid}
            username={result.minecraftUsername}
          />
          <CellText value={result.minecraftUsername} className="font-medium" />
        </div>
      ),
    },
    ...categoryLabels.map((label, i): DataTableColumn<StatResult> => ({
      key: categories[i],
      header: label,
      width: 130,
      align: "right",
      render: (result) => {
        const value = result.values[i];
        const suspicious = isSuspicious(result);
        const total = result.values.reduce((a, b) => a + b, 0);
        const max = Math.max(...result.values);
        return (
          <span
            className={cn(
              "tabular-nums",
              suspicious && value === 0 && "text-yellow-500",
              suspicious &&
                value === max &&
                total > SUSPICIOUS_THRESHOLD &&
                "font-bold text-yellow-500",
            )}
          >
            {value.toLocaleString()}
          </span>
        );
      },
    })),
  ];

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* Header */}
      <AdminPageHeader
        trail={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Tools", href: "/admin/tools" },
          { label: "Stat Search" },
        ]}
      />

      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-4 px-4 pb-4">
        {/* Search Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Search className="size-4 text-muted-foreground" />
              Compare Player Stats
            </CardTitle>
            <CardDescription>
              Search for an item and compare stats across categories. For
              example, see who picked up an item vs. who crafted it.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {/* Item search */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-muted-foreground">
                Item
              </label>
              <form onSubmit={handleSubmit} className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search for an item (e.g. targeting_computer, diamond)..."
                  value={itemInput}
                  onChange={(e) => {
                    setItemInput(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => {
                    // Delay to allow click on suggestion
                    setTimeout(() => setShowSuggestions(false), 200);
                  }}
                  className="pl-9 pr-9"
                />
                {itemInput && (
                  <button
                    type="button"
                    onClick={handleClearItem}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                )}

                {/* Autocomplete dropdown */}
                {showSuggestions &&
                  debouncedItemInput.length >= 2 &&
                  itemsQuery.data &&
                  itemsQuery.data.length > 0 && (
                    <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-popover shadow-lg">
                      {itemsQuery.data.map((item) => (
                        <button
                          key={item}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSelectItem(item);
                          }}
                          className={cn(
                            "flex w-full items-center px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
                            selectedItem === item && "bg-accent/50",
                          )}
                        >
                          <span className="font-medium">
                            {formatStatName(item)}
                          </span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            {item}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
              </form>
              {selectedItem && (
                <p className="text-xs text-muted-foreground">
                  Selected:{" "}
                  <span className="font-mono text-foreground">
                    {selectedItem}
                  </span>
                </p>
              )}
            </div>

            {/* Category toggles */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-muted-foreground">
                Categories to compare
              </label>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_OPTIONS.map((opt) => {
                  const active = selectedCategories.has(opt.key);
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => toggleCategory(opt.key)}
                      className={cn(
                        "cursor-pointer rounded-md border px-3 py-1.5 text-sm transition-colors",
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
                      )}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active search summary */}
            {selectedItem && categories.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>Comparing</span>
                <Badge variant="outline" className="font-mono">
                  {selectedItem}
                </Badge>
                <span>across</span>
                {categoryLabels.map((label) => (
                  <Badge key={label} variant="secondary">
                    {label}
                  </Badge>
                ))}
                {results.length > 0 && (
                  <span className="ml-auto">
                    {results.length} player{results.length !== 1 ? "s" : ""}{" "}
                    found
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results */}
        <Card className="gap-0">
          <CardHeader className="gap-0 border-b">
            <CardTitle>Results</CardTitle>
          </CardHeader>

          {!selectedItem ? (
            <CardContent className="flex flex-1 items-center justify-center py-12">
              <div className="text-center">
                <BarChart3 className="mx-auto size-12 text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">
                  Search for an item to compare stats across players
                </p>
              </div>
            </CardContent>
          ) : compareQuery.error ? (
            <CardContent className="flex flex-1 items-center justify-center py-12">
              <div className="text-center">
                <p className="text-destructive">{compareQuery.error.message}</p>
                <Button
                  onClick={() => compareQuery.refetch()}
                  className="mt-4"
                  variant="outline"
                >
                  Try Again
                </Button>
              </div>
            </CardContent>
          ) : !compareQuery.isLoading && results.length === 0 ? (
            <CardContent className="flex flex-1 items-center justify-center py-12">
              <div className="text-center">
                <Search className="mx-auto size-12 text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">
                  No players found with this item
                </p>
              </div>
            </CardContent>
          ) : (
            <CardContent className="px-0">
              <DataTable
                columns={columns}
                rows={results}
                loading={compareQuery.isLoading}
                rowKey={(result) => result.minecraftUuid}
                onRowClick={(result) =>
                  navigate(`/admin/players/${result.minecraftUuid}`)
                }
                rowClassName={(result) =>
                  isSuspicious(result) ? "bg-yellow-500/5" : undefined
                }
              />
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
