import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface LabeledSwitchProps {
  id: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  label: React.ReactNode;
  className?: string;
}

export function LabeledSwitch({
  id,
  checked,
  onCheckedChange,
  disabled,
  label,
  className,
}: LabeledSwitchProps) {
  return (
    <div
      className={cn(
        "flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3",
        className,
      )}
    >
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      />
      <Label
        htmlFor={id}
        className={cn(
          "cursor-pointer text-sm font-medium",
          disabled && "cursor-not-allowed opacity-70",
        )}
      >
        {label}
      </Label>
    </div>
  );
}
