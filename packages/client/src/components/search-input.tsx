import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SearchInputProps = Omit<
  React.ComponentProps<"input">,
  "value" | "onChange"
> & {
  value: string;
  onValueChange: (value: string) => void;
  inputClassName?: string;
  iconClassName?: string;
  children?: React.ReactNode;
};

export function SearchInput({
  value,
  onValueChange,
  className,
  inputClassName,
  iconClassName,
  children,
  ...props
}: SearchInputProps) {
  return (
    <div className={cn("relative", className)}>
      <Search
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground",
          iconClassName,
        )}
      />
      <Input
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        className={cn("pl-9", inputClassName)}
        {...props}
      />
      {children}
    </div>
  );
}
