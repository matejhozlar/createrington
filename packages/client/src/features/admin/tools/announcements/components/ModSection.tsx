import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

interface Mod {
  name: string;
  url: string;
}

interface ModSectionProps {
  title: string;
  icon: string;
  mods: Mod[];
  onAdd: (mod: Mod) => void;
  onRemove: (index: number) => void;
}

export function ModSection({
  title,
  icon,
  mods,
  onAdd,
  onRemove,
}: ModSectionProps) {
  const [query, setQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebouncedValue(query);

  const searchQuery = trpc.admin.announcements.searchMods.useQuery(
    { query: debouncedQuery },
    { enabled: debouncedQuery.length >= 2 },
  );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(mod: { name: string; url: string }) {
    onAdd({ name: mod.name, url: mod.url });
    setQuery("");
    setShowResults(false);
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">
        {icon} {title}
      </h3>

      <div ref={containerRef} className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search CurseForge..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowResults(true);
            }}
            onFocus={() => query.length >= 2 && setShowResults(true)}
            className="pl-9"
          />
        </div>

        {showResults && query.length >= 2 && (
          <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-border bg-card shadow-lg">
            {searchQuery.isLoading && (
              <div className="flex items-center justify-center gap-2 p-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching...
              </div>
            )}
            {searchQuery.data?.mods.length === 0 && !searchQuery.isLoading && (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No mods found
              </div>
            )}
            {searchQuery.data?.mods.map(
              (mod: {
                id: number;
                name: string;
                url: string;
                thumbnailUrl?: string;
              }) => (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() => handleSelect(mod)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-accent"
                >
                  {mod.thumbnailUrl && (
                    <img
                      src={mod.thumbnailUrl}
                      alt=""
                      className="h-8 w-8 rounded"
                    />
                  )}
                  <span className="truncate">{mod.name}</span>
                </button>
              ),
            )}
          </div>
        )}
      </div>

      {mods.length > 0 && (
        <div className="space-y-1">
          {mods.map((mod, i) => (
            <div
              key={`${mod.name}-${i}`}
              className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
            >
              <a
                href={mod.url}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-primary hover:underline"
              >
                {mod.name}
              </a>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => onRemove(i)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
