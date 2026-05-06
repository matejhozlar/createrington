import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToastActions } from "@/hooks/use-toast";
import {
  INSERT_EMBED_EVENT,
  PENDING_EMBED_KEY,
} from "@/components/admin-chat/actions";
import type { EmbedData } from "@createrington/shared/api/embed";
import { useEmbedBuilder } from "./hooks/use-embed-builder";
import { PresetSidebar } from "./components/PresetSidebar";
import { Topbar } from "./components/Topbar";
import { FormPanel } from "./components/FormPanel";
import { EmbedPreview } from "./components/EmbedPreview";
import { LinkedMessages } from "./components/LinkedMessages";
import type { FocusTarget } from "./focus";

function normalizePartialEmbed(raw: unknown): Partial<EmbedData> {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const out: Partial<EmbedData> = {};

  const stringish = (v: unknown): string | undefined => {
    if (typeof v === "string") return v;
    if (v && typeof v === "object" && "text" in v) {
      const t = (v as { text?: unknown }).text;
      if (typeof t === "string") return t;
    }
    return undefined;
  };

  const urlish = (v: unknown): string | undefined => {
    if (typeof v === "string") return v;
    if (v && typeof v === "object" && "url" in v) {
      const u = (v as { url?: unknown }).url;
      if (typeof u === "string") return u;
    }
    return undefined;
  };

  if ("content" in r && typeof r.content === "string") out.content = r.content;
  if ("title" in r) out.title = stringish(r.title);
  if ("description" in r)
    out.description =
      typeof r.description === "string" ? r.description : undefined;
  if ("url" in r && typeof r.url === "string") out.url = r.url;
  if ("color" in r && typeof r.color === "number") out.color = r.color;
  if ("timestamp" in r && typeof r.timestamp === "boolean")
    out.timestamp = r.timestamp;

  if ("footer" in r) out.footer = stringish(r.footer);

  if ("author" in r) {
    const a = r.author;
    if (typeof a === "string") {
      out.author = a;
    } else if (a && typeof a === "object") {
      const obj = a as Record<string, unknown>;
      if (typeof obj.name === "string") out.author = obj.name;
      if (typeof obj.url === "string") out.authorUrl = obj.url;
      if (typeof obj.icon_url === "string") out.authorIconUrl = obj.icon_url;
    }
  }
  if ("authorUrl" in r && typeof r.authorUrl === "string")
    out.authorUrl = r.authorUrl;
  if ("authorIconUrl" in r && typeof r.authorIconUrl === "string")
    out.authorIconUrl = r.authorIconUrl;

  const imageUrl = urlish(r.image) ?? r.imageUrl;
  if (typeof imageUrl === "string") out.imageUrl = imageUrl;
  const thumbnailUrl = urlish(r.thumbnail) ?? r.thumbnailUrl;
  if (typeof thumbnailUrl === "string") out.thumbnailUrl = thumbnailUrl;

  if ("fields" in r && Array.isArray(r.fields)) {
    out.fields = r.fields
      .filter((f): f is Record<string, unknown> => !!f && typeof f === "object")
      .map((f) => ({
        name: typeof f.name === "string" ? f.name : "",
        value: typeof f.value === "string" ? f.value : "",
        inline: f.inline === true,
      }));
  }

  return out;
}

function applyPartialEmbed(
  setEmbedData: (updater: (prev: EmbedData) => EmbedData) => void,
  partial: unknown,
): void {
  const normalized = normalizePartialEmbed(partial);
  setEmbedData((prev) => ({
    ...prev,
    ...normalized,
    fields: normalized.fields ?? prev.fields,
    buttons: prev.buttons,
    actionButtons: prev.actionButtons,
  }));
}

export function EmbedBuilder() {
  const builder = useEmbedBuilder();
  const isMobile = useIsMobile();
  const toast = useToastActions();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [focused, setFocused] = useState<FocusTarget | null>(null);

  useEffect(() => {
    const pending = (() => {
      try {
        return sessionStorage.getItem(PENDING_EMBED_KEY);
      } catch {
        return null;
      }
    })();
    if (pending) {
      try {
        const parsed = JSON.parse(pending) as Partial<EmbedData>;
        applyPartialEmbed(builder.setEmbedData, parsed);
        toast.success("Embed inserted from Createrington Assistant");
      } catch {
        toast.error("Assistant sent an invalid embed payload");
      } finally {
        try {
          sessionStorage.removeItem(PENDING_EMBED_KEY);
        } catch {
          // ignore
        }
      }
    }

    const handler = (e: Event): void => {
      const detail = (e as CustomEvent<Partial<EmbedData>>).detail;
      if (!detail) return;
      applyPartialEmbed(builder.setEmbedData, detail);
      toast.success("Embed inserted from Createrington Assistant");
    };
    window.addEventListener(INSERT_EMBED_EVENT, handler);
    return () => window.removeEventListener(INSERT_EMBED_EVENT, handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-create blank items when the user clicks +field/+button in the preview.
  useEffect(() => {
    if (!focused) return;
    if (focused === "fields:add" && builder.data.fields.length < 25) {
      const next = [
        ...builder.data.fields.map((f) => ({
          name: f.name,
          value: f.value,
          inline: f.inline,
        })),
        { name: "", value: "", inline: false },
      ];
      builder.setEmbedData((prev) => ({ ...prev, fields: next }));
      setFocused(`field:${next.length - 1}` as FocusTarget);
    }
    if (focused === "buttons:add") {
      const total =
        (builder.data.buttons?.length ?? 0) +
        (builder.data.actionButtons?.length ?? 0);
      if (total >= 5) return;
      builder.setEmbedData((prev) => ({
        ...prev,
        buttons: [...(prev.buttons ?? []), { label: "New button", url: "" }],
      }));
      setFocused(
        `button:link:${builder.data.buttons?.length ?? 0}` as FocusTarget,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused]);

  const externalData: EmbedData = {
    ...builder.data,
    fields: builder.data.fields.map((f) => ({
      name: f.name,
      value: f.value,
      inline: f.inline,
    })),
  };

  return (
    <div className="flex h-svh min-h-0 flex-col">
      <Topbar builder={builder} onMobileSidebar={() => setSidebarOpen(true)} />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="hidden md:flex">
          <PresetSidebar builder={builder} />
        </div>

        {isMobile && (
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetContent
              side="left"
              className="w-72 p-0"
              showCloseButton={false}
            >
              <SheetHeader className="sr-only">
                <SheetTitle>Presets</SheetTitle>
                <SheetDescription>
                  Browse and manage embed presets.
                </SheetDescription>
              </SheetHeader>
              <PresetSidebar
                builder={builder}
                forceExpanded
                className="w-full border-r-0"
                onNavigate={() => setSidebarOpen(false)}
              />
            </SheetContent>
          </Sheet>
        )}

        <main className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-background p-4 md:p-6 lg:flex-row lg:overflow-hidden lg:p-0">
          <section className="flex flex-1 flex-col gap-3 lg:overflow-y-auto lg:p-6">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Preview
              </span>
              <span className="text-xs text-muted-foreground">
                Click anything to edit
              </span>
            </div>
            <EmbedPreview data={externalData} editable onEdit={setFocused} />
            {builder.activePreset && (
              <div className="mt-2">
                <LinkedMessages builder={builder} />
              </div>
            )}
          </section>

          <aside className="flex w-full shrink-0 flex-col border-t border-border bg-card lg:w-[380px] lg:border-l lg:border-t-0">
            <FormPanel
              data={externalData}
              onChange={builder.setEmbedData}
              focused={focused}
              setFocused={setFocused}
            />
          </aside>
        </main>
      </div>
    </div>
  );
}
