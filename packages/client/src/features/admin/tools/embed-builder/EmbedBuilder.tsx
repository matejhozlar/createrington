import { useState } from "react";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Download, Pencil, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";
import type { EmbedData } from "@createrington/shared/api/embed";
import { EmbedForm } from "./components/EmbedForm";
import { EmbedPreview } from "./components/EmbedPreview";
import { ChannelSelector } from "./components/ChannelSelector";
import { PresetManager } from "./components/PresetManager";

const DEFAULT_EMBED: EmbedData = {
  title: undefined,
  description: undefined,
  color: undefined,
  url: undefined,
  fields: [],
  footer: undefined,
  author: undefined,
  authorUrl: undefined,
  authorIconUrl: undefined,
  thumbnailUrl: undefined,
  imageUrl: undefined,
  timestamp: false,
};

export function EmbedBuilder() {
  const toast = useToastActions();
  const [data, setData] = useState<EmbedData>({ ...DEFAULT_EMBED });
  const [channelId, setChannelId] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [loadMessageId, setLoadMessageId] = useState("");

  const utils = trpc.useUtils();
  const sendEmbed = trpc.admin.embeds.send.useMutation();
  const editEmbed = trpc.admin.embeds.edit.useMutation();

  const hasContent = data.title || data.description || data.fields.length > 0;
  const isEditing = !!editingMessageId;

  async function handleSend() {
    if (!channelId) {
      toast.error("Please select a target channel");
      return;
    }
    if (!hasContent) {
      toast.error(
        "Embed must have a title, description, or at least one field",
      );
      return;
    }

    try {
      if (isEditing) {
        await editEmbed.mutateAsync({
          channelId,
          messageId: editingMessageId,
          embed: data,
        });
        toast.success("Embed updated successfully");
      } else {
        const result = await sendEmbed.mutateAsync({ channelId, embed: data });
        setEditingMessageId(result.messageId ?? null);
        toast.success("Embed sent successfully");
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to send embed",
      );
    }
  }

  async function handleLoadMessage() {
    if (!channelId) {
      toast.error("Please select a channel first");
      return;
    }
    if (!loadMessageId.trim()) {
      toast.error("Please enter a message ID");
      return;
    }

    try {
      const result = await utils.admin.embeds.fetchMessage.fetch({
        channelId,
        messageId: loadMessageId.trim(),
      });

      handleLoad(result as EmbedData);
      setEditingMessageId(loadMessageId.trim());
      setLoadMessageId("");
      toast.success("Message loaded");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load message",
      );
    }
  }

  function handleClearEdit() {
    setEditingMessageId(null);
    setData({ ...DEFAULT_EMBED });
  }

  function handleLoad(loaded: EmbedData) {
    const raw = loaded as Record<string, unknown>;

    // Normalize fields that may come back as Discord API objects from saved presets
    const footer =
      raw.footer && typeof raw.footer === "object" && "text" in raw.footer
        ? (raw.footer as { text: string }).text
        : (loaded.footer as string | undefined);

    const author =
      raw.author && typeof raw.author === "object" && "name" in raw.author
        ? (raw.author as { name: string }).name
        : (loaded.author as string | undefined);

    const authorUrl =
      raw.author && typeof raw.author === "object" && "url" in raw.author
        ? ((raw.author as { url?: string }).url ?? loaded.authorUrl)
        : loaded.authorUrl;

    const authorIconUrl =
      raw.author && typeof raw.author === "object" && "icon_url" in raw.author
        ? ((raw.author as { icon_url?: string }).icon_url ??
          loaded.authorIconUrl)
        : loaded.authorIconUrl;

    setData({
      ...DEFAULT_EMBED,
      ...loaded,
      fields: loaded.fields ?? [],
      footer,
      author,
      authorUrl,
      authorIconUrl,
    });
  }

  const isPending = sendEmbed.isPending || editEmbed.isPending;

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* Header */}
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border bg-sidebar px-4">
        <Breadcrumb>
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
              <BreadcrumbPage>Embed Builder</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <div className="flex flex-1 flex-col gap-4 px-4 pb-4">
        {/* Title bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">Embed Builder</h1>
            {isEditing && (
              <div className="flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 text-xs text-primary">
                <Pencil className="size-3" />
                Editing: {editingMessageId}
                <button
                  type="button"
                  onClick={handleClearEdit}
                  className="ml-1 rounded hover:bg-primary/20"
                >
                  <X className="size-3" />
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <PresetManager currentData={data} onLoad={handleLoad} />
            <Button
              onClick={handleSend}
              disabled={isPending || !hasContent || !channelId}
              className="cursor-pointer"
            >
              {isEditing ? (
                <>
                  <Pencil className="mr-1.5 size-4" />
                  {isPending ? "Updating..." : "Update"}
                </>
              ) : (
                <>
                  <Send className="mr-1.5 size-4" />
                  {isPending ? "Sending..." : "Send"}
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          {/* Form column */}
          <div className="space-y-4">
            <ChannelSelector value={channelId} onChange={setChannelId} />

            {/* Load existing message */}
            <div className="flex gap-2">
              <Input
                placeholder="Message ID to load..."
                value={loadMessageId}
                onChange={(e) => setLoadMessageId(e.target.value)}
              />
              <Button
                variant="outline"
                onClick={handleLoadMessage}
                disabled={!channelId || !loadMessageId.trim()}
                className="shrink-0"
              >
                <Download className="mr-1.5 size-4" />
                Load
              </Button>
            </div>

            <EmbedForm data={data} onChange={setData} />
          </div>

          {/* Preview column */}
          <div className="lg:sticky lg:top-4 lg:self-start">
            <div className="space-y-2">
              <h2 className="text-sm font-medium text-muted-foreground">
                Preview
              </h2>
              <EmbedPreview data={data} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
