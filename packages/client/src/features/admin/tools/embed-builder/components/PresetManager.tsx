import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Save, FolderOpen, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";
import type { EmbedData } from "@createrington/shared/api/embed";
import { Loading } from "@/components/loading-spinner";

interface PresetManagerProps {
  currentData: EmbedData;
  onLoad: (data: EmbedData) => void;
}

export function PresetManager({ currentData, onLoad }: PresetManagerProps) {
  const toast = useToastActions();
  const [saveOpen, setSaveOpen] = useState(false);
  const [loadOpen, setLoadOpen] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [search, setSearch] = useState("");
  const [activePreset, setActivePreset] = useState<{
    id: number;
    name: string;
  } | null>(null);

  const presetsQuery = trpc.admin.embeds.presets.list.useQuery(
    { search: search || undefined, limit: 50 },
    { enabled: loadOpen },
  );

  const utils = trpc.useUtils();
  const createPreset = trpc.admin.embeds.presets.create.useMutation();
  const updatePreset = trpc.admin.embeds.presets.update.useMutation();
  const deletePreset = trpc.admin.embeds.presets.delete.useMutation();

  function handleOpenSave() {
    if (activePreset) {
      setPresetName(activePreset.name);
    }
    setSaveOpen(true);
  }

  async function handleSaveAsNew() {
    if (!presetName.trim()) return;

    try {
      await createPreset.mutateAsync({
        name: presetName.trim(),
        data: currentData,
      });
      utils.admin.embeds.presets.list.invalidate();
      toast.success(`Preset "${presetName}" saved`);
      setSaveOpen(false);
      setPresetName("");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save preset",
      );
    }
  }

  async function handleDelete(id: number, name: string) {
    try {
      await deletePreset.mutateAsync({ id });
      toast.success(`Preset "${name}" deleted`);
      if (activePreset?.id === id) {
        setActivePreset(null);
      }
      presetsQuery.refetch();
    } catch {
      toast.error("Failed to delete preset");
    }
  }

  const isSaving = createPreset.isPending || updatePreset.isPending;

  return (
    <>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setLoadOpen(true)}
          className="cursor-pointer"
        >
          <FolderOpen className="mr-1.5 size-3.5" />
          Load
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleOpenSave}
          className="cursor-pointer"
        >
          <Save className="mr-1.5 size-3.5" />
          Save
        </Button>
      </div>

      {/* Save Dialog */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Save Preset
            </DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Preset name"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSaveAsNew()}
          />
          <DialogFooter className="gap-2 sm:gap-0">
            {activePreset && (
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    await updatePreset.mutateAsync({
                      id: activePreset.id,
                      data: currentData,
                    });
                    utils.admin.embeds.presets.list.invalidate();
                    toast.success(`Preset "${activePreset.name}" updated`);
                    setSaveOpen(false);
                    setPresetName("");
                  } catch (err) {
                    toast.error(
                      err instanceof Error
                        ? err.message
                        : "Failed to update preset",
                    );
                  }
                }}
                disabled={isSaving}
                className="cursor-pointer"
              >
                {updatePreset.isPending
                  ? "Updating..."
                  : `Update "${activePreset.name}"`}
              </Button>
            )}
            <Button
              onClick={handleSaveAsNew}
              disabled={!presetName.trim() || isSaving}
              className="cursor-pointer"
            >
              {createPreset.isPending ? "Saving..." : "Save as New"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Load Dialog */}
      <Dialog open={loadOpen} onOpenChange={setLoadOpen}>
        <DialogContent className="max-h-[80vh] overflow-hidden sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Load Preset</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Search presets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="max-h-[50vh] overflow-y-auto">
            {presetsQuery.isLoading ? (
              <div className="flex justify-center py-8">
                <Loading size="small" text="Loading presets..." />
              </div>
            ) : !presetsQuery.data?.presets.length ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No presets found
              </p>
            ) : (
              <div className="space-y-1">
                {presetsQuery.data.presets.map((preset) => (
                  <div
                    key={preset.id}
                    className="flex items-center justify-between rounded-md p-2 hover:bg-accent"
                  >
                    <button
                      type="button"
                      className="flex-1 cursor-pointer text-left"
                      onClick={() => {
                        onLoad(preset.data as EmbedData);
                        setActivePreset({
                          id: preset.id,
                          name: preset.name,
                        });
                        setLoadOpen(false);
                        toast.success(`Loaded "${preset.name}"`);
                      }}
                    >
                      <p className="text-sm font-medium">{preset.name}</p>
                      <p className="text-xs text-muted-foreground">
                        by {preset.createdBy} &middot;{" "}
                        {new Date(preset.updatedAt).toLocaleDateString()}
                      </p>
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(preset.id, preset.name)}
                      disabled={deletePreset.isPending}
                      className="size-8 shrink-0 cursor-pointer p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
