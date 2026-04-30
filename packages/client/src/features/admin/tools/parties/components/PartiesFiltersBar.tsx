import { Filter, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DIMENSIONS } from "@/lib/minecraft";
import type { DimensionFilter, PartyFilters } from "../types";

export function PartiesFiltersBar({
  filters,
  onChange,
}: {
  filters: PartyFilters;
  onChange: (next: PartyFilters) => void;
}) {
  const set = <K extends keyof PartyFilters>(key: K, value: PartyFilters[K]) =>
    onChange({ ...filters, [key]: value });

  const activeCount =
    (filters.search.trim() ? 1 : 0) +
    (filters.dimension !== "all" ? 1 : 0) +
    (filters.alliedOnly ? 1 : 0) +
    (filters.activeForceloadsOnly ? 1 : 0) +
    (filters.optedInOnly ? 1 : 0);

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
              {DIMENSIONS.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <ToggleChip
            id="parties-allied-only"
            label="Allied only"
            checked={filters.alliedOnly}
            onChange={(v) => set("alliedOnly", v)}
          />
          <ToggleChip
            id="parties-active-forceloads-only"
            label="Active forceloads"
            checked={filters.activeForceloadsOnly}
            onChange={(v) => set("activeForceloadsOnly", v)}
          />
          <ToggleChip
            id="parties-opted-in-only"
            label="Opted in"
            checked={filters.optedInOnly}
            onChange={(v) => set("optedInOnly", v)}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function ToggleChip({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3">
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
      <Label htmlFor={id} className="cursor-pointer text-sm font-medium">
        {label}
      </Label>
    </div>
  );
}
