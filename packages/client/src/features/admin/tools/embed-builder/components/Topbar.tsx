import { useState } from "react";
import { Copy, Save, Send, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToastActions } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { embedDataSchema } from "@createrington/shared/api/embed";
import type { UseEmbedBuilder } from "../hooks/use-embed-builder";
import { SendModal } from "./SendModal";
import { SaveAsNewModal } from "./SaveAsNewModal";

interface TopbarProps {
  builder: UseEmbedBuilder;
}

export function Topbar({ builder }: TopbarProps) {
  const {
    presetName,
    setPresetName,
    activePreset,
    isDirty,
    hasContent,
    isPending,
    handleSave,
    externalData,
    setEmbedData,
  } = builder;
  const toast = useToastActions();
  const [sendOpen, setSendOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);

  function handleCopyJson() {
    navigator.clipboard.writeText(JSON.stringify(externalData, null, 2));
    toast.success("Copied to clipboard");
  }

  async function handleImportJson() {
    let text: string;
    try {
      text = await navigator.clipboard.readText();
    } catch {
      toast.error("Couldn't read your clipboard");
      return;
    }

    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      toast.error("Clipboard doesn't contain valid JSON");
      return;
    }

    const result = embedDataSchema.safeParse(raw);
    if (!result.success) {
      toast.error(
        "Clipboard isn't a valid embed — make sure you copied an embed exported from this tool",
      );
      return;
    }

    setEmbedData(result.data);
    toast.success("Embed imported from clipboard");
  }

  const saveDisabled = activePreset
    ? isPending || !isDirty
    : isPending || !hasContent;

  function onSaveClick() {
    if (activePreset) {
      handleSave();
    } else {
      setSaveOpen(true);
    }
  }

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border bg-sidebar px-3 sm:px-4">
        <Breadcrumb className="hidden min-w-0 sm:block">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin/dashboard">Admin</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin/tools">Tools</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Embed builder</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="ml-auto flex min-w-0 max-w-[320px] flex-1 items-center justify-center gap-1.5">
          <input
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            placeholder={activePreset ? activePreset.name : "Untitled embed"}
            className={cn(
              "h-9 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 text-center text-[14px] font-medium outline-none transition-colors",
              "placeholder:text-muted-foreground",
              "hover:bg-accent",
              "focus-visible:border-input focus-visible:bg-background focus-visible:ring-[3px] focus-visible:ring-[var(--primary-glow)]",
            )}
          />
          {isDirty && (
            <span
              title="Unsaved changes"
              className="size-1.5 shrink-0 rounded-full bg-primary"
            />
          )}
        </div>

        <div className="ml-auto flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={handleCopyJson}
                disabled={!hasContent}
                variant="ghost"
                size="icon"
                className="text-muted-foreground"
              >
                <Copy className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Copy as JSON</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={handleImportJson}
                variant="ghost"
                size="icon"
                className="text-muted-foreground"
              >
                <Upload className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Import from clipboard</TooltipContent>
          </Tooltip>

          <Button
            onClick={onSaveClick}
            disabled={saveDisabled}
            variant="outline"
            className="ml-1"
          >
            <Save className="mr-1.5 size-4" />
            {isPending
              ? activePreset
                ? "Saving..."
                : "Creating..."
              : activePreset
                ? "Save"
                : "Save as new"}
          </Button>
          <Button
            onClick={() => setSendOpen(true)}
            disabled={!hasContent}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Send className="mr-1.5 size-4" />
            Send
          </Button>
        </div>
      </header>

      <SendModal open={sendOpen} onOpenChange={setSendOpen} builder={builder} />
      <SaveAsNewModal
        open={saveOpen}
        onOpenChange={setSaveOpen}
        builder={builder}
      />
    </>
  );
}
