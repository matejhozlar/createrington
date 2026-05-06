import { useState } from "react";
import { Copy, PanelLeft, Save, Send, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToastActions } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { EmbedData } from "@createrington/shared/api/embed";
import type { UseEmbedBuilder } from "../hooks/use-embed-builder";
import { SendModal } from "./SendModal";
import { SaveAsNewModal } from "./SaveAsNewModal";

interface TopbarProps {
  builder: UseEmbedBuilder;
  onMobileSidebar?: () => void;
}

export function Topbar({ builder, onMobileSidebar }: TopbarProps) {
  const {
    presetName,
    setPresetName,
    activePreset,
    isDirty,
    hasContent,
    isPending,
    handleSave,
    data,
    setEmbedData,
  } = builder;
  const toast = useToastActions();
  const [sendOpen, setSendOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);

  function handleCopyJson() {
    const exportData: EmbedData = {
      ...data,
      fields: data.fields.map((f) => ({
        name: f.name,
        value: f.value,
        inline: f.inline,
      })),
    };
    navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
    toast.success("Embed JSON copied to clipboard");
  }

  async function handleImportJson() {
    try {
      const text = await navigator.clipboard.readText();
      const parsed = JSON.parse(text) as EmbedData;
      if (!parsed || typeof parsed !== "object") {
        toast.error("Clipboard does not contain valid JSON");
        return;
      }
      setEmbedData({
        content: parsed.content ?? undefined,
        title: parsed.title ?? undefined,
        description: parsed.description ?? undefined,
        color: parsed.color ?? undefined,
        url: parsed.url ?? undefined,
        footer: parsed.footer ?? undefined,
        author: parsed.author ?? undefined,
        authorUrl: parsed.authorUrl ?? undefined,
        authorIconUrl: parsed.authorIconUrl ?? undefined,
        thumbnailUrl: parsed.thumbnailUrl ?? undefined,
        imageUrl: parsed.imageUrl ?? undefined,
        timestamp: parsed.timestamp ?? false,
        fields: Array.isArray(parsed.fields)
          ? parsed.fields.map((f) => ({
              name: f.name ?? "",
              value: f.value ?? "",
              inline: f.inline ?? false,
            }))
          : [],
        buttons: Array.isArray(parsed.buttons)
          ? parsed.buttons.map((b) => ({
              label: b.label ?? "",
              url: b.url ?? "",
              emoji: b.emoji ?? undefined,
            }))
          : [],
        actionButtons: Array.isArray(parsed.actionButtons)
          ? parsed.actionButtons.map((b) => ({
              label: b.label ?? "",
              action: "create_thread" as const,
              channelId: b.channelId ?? "",
              threadName: b.threadName ?? "",
              threadMessage: b.threadMessage ?? "",
              emoji: b.emoji ?? undefined,
            }))
          : [],
      });
      toast.success("Embed imported from clipboard");
    } catch {
      toast.error(
        "Failed to import — make sure you have valid embed JSON in your clipboard",
      );
    }
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
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-3 sm:px-4">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden shrink-0"
          onClick={onMobileSidebar}
          aria-label="Open presets"
        >
          <PanelLeft className="size-5" />
        </Button>

        <nav className="hidden min-w-0 items-center gap-1.5 text-[13px] sm:flex">
          <a
            href="/admin/dashboard"
            className="text-muted-foreground hover:text-foreground"
          >
            Admin
          </a>
          <span className="text-muted-foreground">/</span>
          <a
            href="/admin/tools"
            className="text-muted-foreground hover:text-foreground"
          >
            Tools
          </a>
          <span className="text-muted-foreground">/</span>
          <span className="font-medium text-foreground">Embed builder</span>
        </nav>

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
