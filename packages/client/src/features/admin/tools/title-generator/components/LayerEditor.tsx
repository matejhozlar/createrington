import { useState } from "react";
import {
  ChevronDown,
  Copy,
  Download,
  FileUp,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToastActions } from "@/hooks/use-toast";
import type { Catalog } from "../engine/assets";
import {
  applyPreset,
  createLayer,
  exportPreset,
  parsePreset,
} from "../engine/settings";
import type { TitleLayer } from "../engine/types";
import type { LayerUpdate } from "../hooks/use-title-project";
import { OverlayTab } from "./OverlayTab";
import { PresetImportDialog } from "./PresetImportDialog";
import { SettingsTab } from "./SettingsTab";
import { StyleTab } from "./StyleTab";
import { TextTab } from "./TextTab";
import { TextureTab } from "./TextureTab";

const TABS = [
  { value: "text", label: "Text", Component: TextTab },
  { value: "texture", label: "Texture", Component: TextureTab },
  { value: "overlay", label: "Overlay", Component: OverlayTab },
  { value: "style", label: "Style", Component: StyleTab },
  { value: "settings", label: "Settings", Component: SettingsTab },
] as const;

function presetFileName(layer: TitleLayer) {
  const name = layer.text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_");
  return `${name || "minecraft_title"}_preset.json`;
}

export function LayerEditor({
  layer,
  catalog,
  onChange,
}: {
  layer: TitleLayer;
  catalog: Catalog;
  onChange: (update: LayerUpdate) => void;
}) {
  const toast = useToastActions();
  const [tab, setTab] = useState<string>("text");
  const [importOpen, setImportOpen] = useState(false);

  const presetJson = () => {
    try {
      return JSON.stringify(exportPreset(layer));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to export preset",
      );
      return null;
    }
  };

  const copyPreset = async () => {
    const json = presetJson();
    if (!json) return;
    await navigator.clipboard.writeText(json);
    toast.success("Preset copied to clipboard");
  };

  const downloadPreset = () => {
    const json = presetJson();
    if (!json) return;
    const url = URL.createObjectURL(
      new Blob([json], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = presetFileName(layer);
    link.click();
    URL.revokeObjectURL(url);
  };

  const importPreset = async (json: string) => {
    const next = await applyPreset(layer, parsePreset(json), catalog);
    onChange(() => next);
    toast.success("Preset imported");
  };

  const resetLayer = () => {
    onChange(() => createLayer({ id: layer.id, text: layer.text }));
  };

  return (
    <Card className="gap-2">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="flex min-w-0 items-center gap-2 text-base">
          <SlidersHorizontal className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">
            {layer.text.trim() || "Untitled text"}
          </span>
        </CardTitle>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Presets
                <ChevronDown className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={copyPreset}>
                <Copy className="size-4" />
                Copy preset
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={downloadPreset}>
                <Download className="size-4" />
                Download preset
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setImportOpen(true)}>
                <FileUp className="size-4" />
                Import preset...
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={resetLayer}>
            <RotateCcw className="size-4" />
            Reset
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={tab} onValueChange={setTab} className="gap-4">
          <div className="overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <TabsList>
              {TABS.map((entry) => (
                <TabsTrigger
                  key={entry.value}
                  value={entry.value}
                  className="cursor-pointer text-foreground/80"
                >
                  {entry.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          {TABS.map(({ value, Component }) => (
            <TabsContent key={value} value={value} tabIndex={-1}>
              <Component layer={layer} catalog={catalog} onChange={onChange} />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
      <PresetImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={importPreset}
      />
    </Card>
  );
}
