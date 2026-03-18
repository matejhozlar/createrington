import { EditorToolbar } from "./EditorToolbar";
import { EmbedForm } from "./EmbedForm";
import { EmbedPreview } from "./EmbedPreview";
import { LinkedMessages } from "./LinkedMessages";
import type { EmbedData } from "@createrington/shared/api/embed";
import type { UseEmbedBuilder } from "../hooks/use-embed-builder";

interface EditorPanelProps {
  builder: UseEmbedBuilder;
}

export function EditorPanel({ builder }: EditorPanelProps) {
  const { data, setEmbedData, activePreset } = builder;

  // EmbedForm expects EmbedData (without _id), so we strip internal fields
  const externalData: EmbedData = {
    ...data,
    fields: data.fields.map((f) => ({ name: f.name, value: f.value, inline: f.inline })),
  };

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
      <EditorToolbar builder={builder} />

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        {/* Form column */}
        <div className="space-y-4">
          <EmbedForm data={externalData} onChange={setEmbedData} />
          {activePreset && <LinkedMessages builder={builder} />}
        </div>

        {/* Preview column */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <div className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground">
              Preview
            </h2>
            <EmbedPreview data={externalData} />
          </div>
        </div>
      </div>
    </div>
  );
}
