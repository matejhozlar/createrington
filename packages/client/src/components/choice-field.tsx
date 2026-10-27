import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function ChoiceField<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: readonly { value: T; label: string; disabled?: boolean }[];
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <Tabs value={value} onValueChange={(next) => onChange(next as T)}>
      <div className="overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <TabsList className={className}>
          {options.map((option) => (
            <TabsTrigger
              key={option.value}
              value={option.value}
              disabled={option.disabled}
              className="cursor-pointer text-foreground/80"
            >
              {option.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
    </Tabs>
  );
}
