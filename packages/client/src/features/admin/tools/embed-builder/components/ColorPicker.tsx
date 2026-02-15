import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";

interface ColorPickerProps {
  value: number | undefined;
  onChange: (color: number | undefined) => void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const [customHex, setCustomHex] = useState("");
  const colorsQuery = trpc.admin.embeds.colors.useQuery();
  const colors = colorsQuery.data ?? [];

  const selectedHex =
    value !== undefined
      ? `#${value.toString(16).padStart(6, "0")}`
      : undefined;

  function handleCustomHex(hex: string) {
    setCustomHex(hex);
    const clean = hex.replace("#", "");
    if (/^[0-9a-fA-F]{6}$/.test(clean)) {
      onChange(parseInt(clean, 16));
    }
  }

  return (
    <div className="space-y-3">
      <Label>Color</Label>
      <div className="flex flex-wrap gap-2">
        {colors.map((color) => (
          <button
            key={color.name}
            type="button"
            title={color.name}
            onClick={() =>
              onChange(value === color.value ? undefined : color.value)
            }
            className={cn(
              "size-8 cursor-pointer rounded-md border-2 transition-all",
              value === color.value
                ? "scale-110 border-white ring-2 ring-primary"
                : "border-transparent hover:scale-105",
            )}
            style={{ backgroundColor: color.hex }}
          />
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div
          className="size-8 shrink-0 rounded-md border border-border"
          style={{
            backgroundColor: selectedHex ?? "#313338",
          }}
        />
        <Input
          placeholder="#ff0000"
          value={customHex}
          onChange={(e) => handleCustomHex(e.target.value)}
          className="w-28"
        />
        {value !== undefined && (
          <button
            type="button"
            onClick={() => {
              onChange(undefined);
              setCustomHex("");
            }}
            className="cursor-pointer text-xs text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
