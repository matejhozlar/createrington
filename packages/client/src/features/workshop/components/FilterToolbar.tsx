import { useRef } from "react";
import { SearchInput } from "@/components/search-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClearButton } from "./ClearButton";
import { ViewToggle, type ViewMode } from "./ViewToggle";

export function FilterToolbar({
  search,
  onSearchChange,
  placeholder,
  view,
  onViewChange,
  children,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  placeholder: string;
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
  children: React.ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="-mt-2 flex flex-wrap items-center gap-2.5">
      <SearchInput
        ref={inputRef}
        className="w-full min-w-0 flex-none sm:max-w-[420px] sm:min-w-[200px] sm:flex-1"
        value={search}
        onValueChange={onSearchChange}
        placeholder={placeholder}
        iconClassName="left-2.5 size-[15px]"
        inputClassName="h-9 rounded-lg bg-white/[0.03] pr-8 pl-8 text-[13px]"
      >
        {search && (
          <ClearButton
            className="right-1"
            inputRef={inputRef}
            onClick={() => onSearchChange("")}
          />
        )}
      </SearchInput>
      <span className="hidden flex-1 sm:block" />
      {children}
      <ViewToggle view={view} onChange={onViewChange} />
    </div>
  );
}

export function FilterSelect<T extends string>({
  value,
  onValueChange,
  options,
  className,
}: {
  value: T;
  onValueChange: (value: T) => void;
  options: ReadonlyArray<{ value: T; label: string }>;
  className: string;
}) {
  return (
    <Select value={value} onValueChange={(next) => onValueChange(next as T)}>
      <SelectTrigger className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
