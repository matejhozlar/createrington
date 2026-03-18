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
    fields: data.fields.map((f) => ({
      name: f.name,
      value: f.value,
      inline: f.inline,
    })),
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Toolbar — pinned at top */}
      <div className="shrink-0 p-4 pb-0">
        <EditorToolbar builder={builder} />
      </div>

      {/* Content area — form scrolls, preview stays fixed */}
      <div className="grid min-h-0 flex-1 gap-4 p-4 lg:grid-cols-[1fr_1fr]">
        {/* Form column — only this scrolls */}
        <div className="min-h-0 space-y-4 overflow-y-auto">
          <EmbedForm data={externalData} onChange={setEmbedData} />
          {activePreset && <LinkedMessages builder={builder} />}
        </div>

        {/* Preview column — fixed in place, scrolls independently if needed */}
        <div className="min-h-0 overflow-y-auto">
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
