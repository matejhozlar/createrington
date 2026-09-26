import { Section, SliderField, ToggleField } from "./fields";
import type { LayerTabProps } from "./types";

const SCALE_AXES = [
  { key: "scaleX", label: "X" },
  { key: "scaleY", label: "Y" },
  { key: "scaleZ", label: "Z" },
] as const;

export function SettingsTab({ layer, catalog, onChange }: LayerTabProps) {
  const font = catalog.fonts[layer.font];

  return (
    <div className="flex flex-col gap-6">
      <Section title="Spacing">
        <div className="grid gap-4 sm:grid-cols-2">
          <SliderField
            label="Character spacing"
            value={layer.characterSpacing}
            min={0}
            max={20}
            onChange={(characterSpacing) => onChange({ characterSpacing })}
          />
          <SliderField
            label="Row spacing"
            value={layer.rowSpacing}
            min={-4}
            max={20}
            onChange={(rowSpacing) => onChange({ rowSpacing })}
          />
        </div>
      </Section>

      <Section title="Scale">
        <div className="grid gap-4 sm:grid-cols-3">
          {SCALE_AXES.map((axis) => (
            <SliderField
              key={axis.key}
              label={axis.label}
              value={layer[axis.key]}
              min={0.05}
              max={4}
              step={0.05}
              onChange={(value) => onChange({ [axis.key]: value })}
            />
          ))}
        </div>
      </Section>

      {(!font.forcedTerminators || font.shifts) && (
        <Section title="Characters">
          <div className="flex flex-wrap gap-2">
            {!font.forcedTerminators && (
              <ToggleField
                label="Line terminators"
                checked={layer.terminators}
                onChange={(terminators) => onChange({ terminators })}
              />
            )}
            {font.shifts && (
              <ToggleField
                label="Disable character shifting"
                checked={layer.disableCharacterShifting}
                onChange={(disableCharacterShifting) =>
                  onChange({ disableCharacterShifting })
                }
              />
            )}
          </div>
          {font.shifts && (
            <p className="text-sm text-muted-foreground">
              Character shifting tucks certain letter pairs closer together for
              better readability.
            </p>
          )}
        </Section>
      )}
    </div>
  );
}
