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
 * Merge a partial embed coming from an admin-chat action into the current
 * form state. Anything the partial does not specify is left untouched so
 * Claude can drop just a title+description without wiping the admin's
 * in-progress draft.
 */
function applyPartialEmbed(
  setEmbedData: (updater: (prev: EmbedData) => EmbedData) => void,
  partial: Partial<EmbedData>,
): void {
  setEmbedData((prev) => ({
    ...prev,
    ...partial,
    fields: partial.fields ?? prev.fields,
    buttons: partial.buttons ?? prev.buttons,
    actionButtons: partial.actionButtons ?? prev.actionButtons,
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
        toast.success("Embed inserted from Claude");
      } catch {
        toast.error("Claude's embed payload was invalid");
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
      toast.success("Embed inserted from Claude");
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
