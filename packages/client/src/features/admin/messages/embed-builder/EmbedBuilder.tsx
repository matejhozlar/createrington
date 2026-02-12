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
import { Send } from "lucide-react";
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

  const sendEmbed = trpc.admin.embeds.send.useMutation();

  const hasContent =
    data.title || data.description || data.fields.length > 0;

  async function handleSend() {
    if (!channelId) {
      toast.error("Please select a target channel");
      return;
    }
    if (!hasContent) {
      toast.error("Embed must have a title, description, or at least one field");
      return;
    }

    try {
      await sendEmbed.mutateAsync({ channelId, embed: data });
      toast.success("Embed sent successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send embed");
    }
  }

  function handleLoad(loaded: EmbedData) {
    setData({
      ...DEFAULT_EMBED,
      ...loaded,
      fields: loaded.fields ?? [],
    });
  }

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
              <BreadcrumbLink href="/admin/messages">Messages</BreadcrumbLink>
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
          <h1 className="text-2xl font-semibold">Embed Builder</h1>
          <div className="flex items-center gap-2">
            <PresetManager currentData={data} onLoad={handleLoad} />
            <Button
              onClick={handleSend}
              disabled={sendEmbed.isPending || !hasContent || !channelId}
              className="cursor-pointer"
            >
              <Send className="mr-1.5 size-4" />
              {sendEmbed.isPending ? "Sending..." : "Send"}
            </Button>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          {/* Form column */}
          <div className="space-y-4">
            <ChannelSelector value={channelId} onChange={setChannelId} />
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
