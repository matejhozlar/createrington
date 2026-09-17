import { Filter, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { useSearchShortcut } from "@/features/admin/hooks/use-search-shortcut";
import { MODIFIER_KEY_LABEL } from "@/lib/platform";

/**
 * Standard admin filters card: a search input with optional extra controls
 * rendered after it. Ctrl+K (or Cmd+K) focuses the search from anywhere on
 * the page and Escape blurs it; the shortcut hint hides on small screens.
 * `activeCount` renders the active-filter badge next to the title.
 */
export function FilterBar({
  search,
  onSearchChange,
  placeholder,
  activeCount,
  children,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  placeholder: string;
  activeCount: number;
  children?: React.ReactNode;
}) {
  const searchRef = useSearchShortcut();

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
      <CardContent className="flex flex-col gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            type="text"
            placeholder={placeholder}
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            className="pl-9 sm:pr-16"
          />
          <Kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 sm:block">
            {MODIFIER_KEY_LABEL} K
          </Kbd>
        </div>
        {children && <div className="flex flex-wrap gap-2">{children}</div>}
      </CardContent>
    </Card>
  );
}
