import { ChoiceField } from "@/components/choice-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  BACKDROPS,
  GUI_SCALES,
  RANKS,
  type Backdrop,
  type GuiScale,
} from "../presets";
import type { PreviewSettings as Settings } from "../hooks/use-preview-settings";

const LAYOUTS = {
  row: {
    root: "flex flex-wrap items-center gap-x-6 gap-y-3",
    field: "flex items-center gap-2.5",
    guiScale: true,
  },
  list: {
    root: "flex flex-col divide-y rounded-xl border bg-card",
    field: "flex min-h-14 items-center justify-between gap-3 px-3.5 py-2.5",
    guiScale: false,
  },
} as const;

export function PreviewSettings({
  settings,
  onChange,
  layout,
  className,
}: {
  settings: Settings;
  onChange: (changes: Partial<Settings>) => void;
  layout: keyof typeof LAYOUTS;
  className?: string;
}) {
  const styles = LAYOUTS[layout];

  return (
    <div className={cn(styles.root, className)}>
      <div className={styles.field}>
        <span className="text-sm font-medium">Your rank</span>
        <Select
          value={String(settings.rank)}
          onValueChange={(value) => onChange({ rank: Number(value) })}
        >
          <SelectTrigger aria-label="Your rank">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANKS.map((option, i) => (
              <SelectItem key={option.label} value={String(i)}>
                <img
                  src={option.icon}
                  alt=""
                  className="h-4 w-[21px] shrink-0 object-contain [image-rendering:pixelated]"
                />
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {styles.guiScale && (
        <div className={styles.field}>
          <span className="text-sm font-medium">GUI scale</span>
          <ChoiceField
            value={settings.guiScale}
            options={GUI_SCALES.map((value) => ({ value, label: value }))}
            onChange={(guiScale: GuiScale) => onChange({ guiScale })}
          />
        </div>
      )}
      <div className={styles.field}>
        <span className="text-sm font-medium">Behind</span>
        <ChoiceField
          value={settings.backdrop}
          options={BACKDROPS}
          onChange={(backdrop: Backdrop) => onChange({ backdrop })}
        />
      </div>
    </div>
  );
}
