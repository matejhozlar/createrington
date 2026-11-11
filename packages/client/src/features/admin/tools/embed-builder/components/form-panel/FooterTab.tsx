import { Switch } from "@/components/ui/switch";
import { TextField } from "../form-primitives";
import type { TabProps } from "./types";

export function FooterTab({ data, set }: TabProps) {
  return (
    <>
      <TextField
        label="Footer text"
        value={data.footer}
        onChange={(v) => set({ footer: v || undefined })}
        max={2048}
        placeholder="Footer text"
        mentions
      />

      <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-card p-3 hover:border-[var(--border-strong)]">
        <Switch
          checked={!!data.timestamp}
          onCheckedChange={(checked) => set({ timestamp: checked })}
        />
        <div className="space-y-0.5">
          <div className="text-[13px] font-medium text-foreground">
            Include timestamp
          </div>
          <div className="text-xs text-muted-foreground">
            Shows the current time when the embed is sent.
          </div>
        </div>
      </label>
    </>
  );
}
