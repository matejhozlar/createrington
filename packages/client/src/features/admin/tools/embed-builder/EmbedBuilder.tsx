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

export function EmbedBuilder() {
  const builder = useEmbedBuilder();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
