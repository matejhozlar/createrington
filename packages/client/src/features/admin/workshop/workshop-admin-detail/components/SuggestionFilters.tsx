import { Filter, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MOD_STATUS_STYLES } from "@/features/workshop/format";
import { WORKSHOP_MOD_STATUSES } from "@createrington/shared/workshop";
import type { WorkshopModStatus } from "@createrington/shared/db";

export type StatusFilter = "all" | WorkshopModStatus;

const STATUS_FILTERS = ["all", ...WORKSHOP_MOD_STATUSES] as const;

export function SuggestionFilters({
  search,
  onSearchChange,
  status,
  onStatusChange,
  counts,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  status: StatusFilter;
  onStatusChange: (value: StatusFilter) => void;
  counts: Record<string, number>;
}) {
  return (
    <Card className="gap-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Filter className="size-4 text-muted-foreground" />
          Filters
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by mod or player..."
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((value) => (
            <Button
              key={value}
              variant={status === value ? "secondary" : "ghost"}
              size="sm"
              onClick={() => onStatusChange(value)}
            >
              {value === "all" ? "All" : MOD_STATUS_STYLES[value].label}
              <Badge variant="outline" className="ml-1.5 text-xs">
                {counts[value] ?? 0}
              </Badge>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
