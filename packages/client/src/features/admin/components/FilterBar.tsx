import { Filter } from "lucide-react";
import { SearchInput } from "@/components/search-input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Kbd } from "@/components/ui/kbd";
import { useSearchShortcut } from "@/features/admin/hooks/use-search-shortcut";
import { MODIFIER_KEY_LABEL } from "@/lib/platform";
import { cn } from "@/lib/utils";

export function FilterBar({
  search,
  onSearchChange,
  placeholder,
  activeCount,
  title = "Filters",
  actions,
  className,
  children,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  placeholder: string;
  activeCount: number;
  title?: string;
  actions?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  const searchRef = useSearchShortcut();

  return (
    <Card className={cn("gap-2", className)}>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="size-4 text-muted-foreground" />
            {title}
            {activeCount > 0 && (
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                {activeCount}
              </Badge>
            )}
          </CardTitle>
          {actions}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <SearchInput
          ref={searchRef}
          placeholder={placeholder}
          value={search}
          onValueChange={onSearchChange}
          inputClassName="sm:pr-16"
        >
          <Kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 sm:block">
            {MODIFIER_KEY_LABEL} K
          </Kbd>
        </SearchInput>
        {children && <div className="flex flex-wrap gap-2">{children}</div>}
      </CardContent>
    </Card>
  );
}
