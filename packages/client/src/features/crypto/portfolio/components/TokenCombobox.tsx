import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface TokenOption {
  symbol: string;
  name: string;
}

interface TokenComboboxProps {
  tokens: TokenOption[];
  value: string;
  onChange: (symbol: string) => void;
  disabled?: boolean;
}

export function TokenCombobox({
  tokens,
  value,
  onChange,
  disabled,
}: TokenComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tokens;
    return tokens.filter(
      (t) =>
        t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q),
    );
  }, [tokens, query]);

  const selected = tokens.find((t) => t.symbol === value);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.children[activeIndex]?.scrollIntoView({
      block: "nearest",
    });
  }, [activeIndex, open]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setQuery("");
  };

  const select = (symbol: string) => {
    onChange(symbol);
    handleOpenChange(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const token = filtered[activeIndex];
      if (token) select(token.symbol);
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={cn(
            "mt-1 flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          <span
            className={cn("truncate", !selected && "text-muted-foreground")}
          >
            {selected ? selected.symbol : "Select token"}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) p-0"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          searchRef.current?.focus();
        }}
      >
        <div className="flex items-center border-b px-3">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search tokens..."
            className="h-9 w-full bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div
          ref={listRef}
          role="listbox"
          className="max-h-56 overflow-y-auto p-1"
        >
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No tokens found
            </p>
          ) : (
            filtered.map((t, i) => (
              <button
                key={t.symbol}
                type="button"
                role="option"
                aria-selected={t.symbol === value}
                onClick={() => select(t.symbol)}
                onMouseMove={() => setActiveIndex(i)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors",
                  i === activeIndex && "bg-accent text-accent-foreground",
                  t.symbol === value && "bg-accent/50",
                )}
              >
                <span className="flex min-w-0 flex-col">
                  <span className="font-medium">{t.symbol}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {t.name}
                  </span>
                </span>
                {t.symbol === value && <Check className="size-4 shrink-0" />}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
