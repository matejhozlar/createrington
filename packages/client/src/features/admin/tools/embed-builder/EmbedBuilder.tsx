import { useState, useEffect } from "react";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { PanelLeft } from "lucide-react";
import { useEmbedBuilder } from "./hooks/use-embed-builder";
import { PresetSidebar } from "./components/PresetSidebar";
import { EditorPanel } from "./components/EditorPanel";
import {
  INSERT_EMBED_EVENT,
  PENDING_EMBED_KEY,
} from "@/components/admin-chat/actions";
import { useToastActions } from "@/hooks/use-toast";
import type { EmbedData } from "@createrington/shared/api/embed";

/**
 * Normalize a partial embed coming from Claude (or any external source)
 * into the shape the builder stores internally. Discord's public embed
 * shape uses nested objects — `footer: {text}`, `author: {name, url,
 * icon_url}`, `image: {url}`, `thumbnail: {url}` — while the builder
 * keeps each field as a flat scalar. Without this normalization a nested
 * payload lands in React state as an object and crashes the editor with
 * "Objects are not valid as a React child" (error #31).
 */
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

  // Discord uses `image: {url}` / `thumbnail: {url}`; builder stores flat.
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

/**
 * Merge a partial embed into the current form state. Anything not specified
 * is left untouched so Claude can drop just a title+description without
 * wiping the admin's in-progress draft. Normalizes nested Discord shapes
 * first so object-shaped fields don't end up as React children.
 */
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const toast = useToastActions();

  // Accept embeds dispatched from the admin-chat widget: either via a
  // pending sessionStorage entry (navigated here after clicking Apply
  // while on another page) or via INSERT_EMBED_EVENT (clicked Apply
  // while already here).
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
    // builder.setEmbedData is a stable useCallback, toast is stable from the hook.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header */}
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border bg-sidebar px-4">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden shrink-0"
          onClick={() => setSidebarOpen(true)}
        >
          <PanelLeft className="size-5" />
        </Button>
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

      {/* Sidebar + Editor layout */}
      <div className="flex h-[calc(100svh-4rem)] overflow-hidden">
        {/* Desktop sidebar */}
        <div className="hidden md:flex">
          <PresetSidebar builder={builder} />
        </div>

        {/* Mobile sidebar (Sheet) */}
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
                className="w-full border-r-0"
                onNavigate={() => setSidebarOpen(false)}
              />
            </SheetContent>
          </Sheet>
        )}

        <EditorPanel builder={builder} />
      </div>
    </div>
  );
}
