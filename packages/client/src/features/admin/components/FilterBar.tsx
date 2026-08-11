import { useEffect, useRef } from "react";
import { Filter, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

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
  const searchWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const input = () => searchWrapRef.current?.querySelector("input") ?? null;

    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        input()?.focus();
        return;
      }
      if (event.key === "Escape" && event.target === input()) {
        input()?.blur();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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
        <div ref={searchWrapRef} className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder={placeholder}
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            className="pl-9 sm:pr-16"
          />
          <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:block">
            Ctrl K
          </kbd>
        </div>
        {children && <div className="flex flex-wrap gap-2">{children}</div>}
      </CardContent>
    </Card>
  );
}
