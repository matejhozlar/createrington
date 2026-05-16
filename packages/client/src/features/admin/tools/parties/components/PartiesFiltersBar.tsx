import { Filter, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LabeledSwitch } from "@/components/labeled-switch";
import { formatDimension } from "@/lib/minecraft";
import type {
  AlliedFilter,
  DimensionFilter,
  OptedInFilter,
  PartyFilters,
} from "../types";

const ALLIED_OPTIONS: { value: AlliedFilter; label: string }[] = [
  { value: "all", label: "Allied: all" },
  { value: "allied", label: "Allied" },
  { value: "notAllied", label: "Not allied" },
];

const OPTED_IN_OPTIONS: { value: OptedInFilter; label: string }[] = [
  { value: "all", label: "Opt-in: all" },
  { value: "optedIn", label: "Opted in" },
  { value: "optedOut", label: "Opted out" },
];

export function PartiesFiltersBar({
  filters,
  onChange,
  dimensions,
}: {
  filters: PartyFilters;
  onChange: (next: PartyFilters) => void;
  dimensions: string[];
}) {
  const set = <K extends keyof PartyFilters>(key: K, value: PartyFilters[K]) =>
    onChange({ ...filters, [key]: value });

  const activeCount =
    (filters.search.trim() ? 1 : 0) +
    (filters.dimension !== "all" ? 1 : 0) +
    (filters.allied !== "all" ? 1 : 0) +
    (filters.activeForceloadsOnly ? 1 : 0) +
    (filters.optedIn !== "all" ? 1 : 0);

  return (
    <Card className="gap-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Filter className="size-4 text-muted-foreground" />
          Filters
          {activeCount > 0 && (
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
              {activeCount}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-48 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filters.search}
              onChange={(e) => set("search", e.target.value)}
              placeholder="Search by party name..."
              className="pl-9"
            />
          </div>

          <Select
            value={filters.dimension}
            onValueChange={(v) => set("dimension", v as DimensionFilter)}
          >
            <SelectTrigger className="min-w-[160px]">
              <SelectValue placeholder="Dimension" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All dimensions</SelectItem>
              {dimensions.map((id) => (
                <SelectItem key={id} value={id}>
                  {formatDimension(id)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.allied}
            onValueChange={(v) => set("allied", v as AlliedFilter)}
          >
            <SelectTrigger className="min-w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ALLIED_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.optedIn}
            onValueChange={(v) => set("optedIn", v as OptedInFilter)}
          >
            <SelectTrigger className="min-w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPTED_IN_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <LabeledSwitch
            id="parties-active-forceloads-only"
            checked={filters.activeForceloadsOnly}
            onCheckedChange={(v) => set("activeForceloadsOnly", v)}
            label="Active forceloads"
          />
        </div>
      </CardContent>
    </Card>
  );
}
