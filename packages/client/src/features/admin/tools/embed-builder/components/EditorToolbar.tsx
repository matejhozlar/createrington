import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Send, Save } from "lucide-react";
import { SendModal } from "./SendModal";
import type { UseEmbedBuilder } from "../hooks/use-embed-builder";

interface EditorToolbarProps {
  builder: UseEmbedBuilder;
}

export function EditorToolbar({ builder }: EditorToolbarProps) {
  const {
    presetName,
    setPresetName,
    activePreset,
    selectedCategoryId,
    setSelectedCategoryId,
    isDirty,
    hasContent,
    isPending,
    categoriesQuery,
    handleSave,
    handleSetPresetCategory,
  } = builder;

  const [sendOpen, setSendOpen] = useState(false);
  const categories = categoriesQuery.data ?? [];

  const saveDisabled = activePreset
    ? isPending || !isDirty
    : isPending || !presetName.trim();

  const saveLabel = activePreset
    ? isPending
      ? "Saving..."
      : "Save"
    : isPending
      ? "Creating..."
      : "Save as New";

  function handleCategoryChange(value: string) {
    const newCategoryId = value === "none" ? null : Number(value);

    if (activePreset) {
      handleSetPresetCategory(activePreset.id, newCategoryId);
    } else {
      setSelectedCategoryId(newCategoryId);
    }
  }

  return (
    <>
      <div className="flex items-end gap-3">
        <div className="flex-1 space-y-2">
          <Label>Preset Name</Label>
          <Input
            placeholder={activePreset ? activePreset.name : "Unnamed embed..."}
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
          />
        </div>
        <div className="w-40 space-y-2">
          <Label>Category</Label>
          <Select
            value={selectedCategoryId?.toString() ?? "none"}
            onValueChange={handleCategoryChange}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Uncategorized" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Uncategorized</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id.toString()}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={handleSave}
              disabled={saveDisabled}
              className="shrink-0 cursor-pointer"
              variant="outline"
            >
              <Save className="mr-1.5 size-4" />
              {saveLabel}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {activePreset
              ? "Save changes to this preset"
              : "Save as a new preset"}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={() => setSendOpen(true)}
              disabled={!hasContent}
              className="shrink-0 cursor-pointer"
            >
              <Send className="mr-1.5 size-4" />
              Send
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Send embed to a Discord channel
          </TooltipContent>
        </Tooltip>
      </div>

      <SendModal open={sendOpen} onOpenChange={setSendOpen} builder={builder} />
    </>
  );
}
