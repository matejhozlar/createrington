import { FilterBar } from "@/features/admin/components/FilterBar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BUMP_FILTERS,
  type BumpFilter,
  type ChangelogFilters,
} from "@/features/admin/changelog/parse";

export function Toolbar({
  filters,
  onChange,
  packages,
}: {
  filters: ChangelogFilters;
  onChange: (patch: Partial<ChangelogFilters>) => void;
  packages: string[];
}) {
  const activeCount =
    (filters.search.trim() ? 1 : 0) +
    (filters.packageName !== "all" ? 1 : 0) +
    (filters.bump !== "all" ? 1 : 0);

  return (
    <FilterBar
      search={filters.search}
      onSearchChange={(search) => onChange({ search })}
      placeholder="Search the changelog..."
      activeCount={activeCount}
      className="mb-7"
    >
      <Select
        value={filters.packageName}
        onValueChange={(packageName) => onChange({ packageName })}
      >
        <SelectTrigger className="w-full sm:w-[200px]">
          <SelectValue placeholder="Package" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All packages</SelectItem>
          {packages.map((p) => (
            <SelectItem key={p} value={p}>
              {p}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.bump}
        onValueChange={(bump) => onChange({ bump: bump as BumpFilter })}
      >
        <SelectTrigger className="w-full sm:w-[160px]">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          {BUMP_FILTERS.map(({ value, label }) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FilterBar>
  );
}
