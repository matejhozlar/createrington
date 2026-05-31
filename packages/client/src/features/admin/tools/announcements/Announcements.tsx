import { useState } from "react";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { FileText, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { ModpackChangelog } from "./ModpackChangelog";
import { MaintenanceAnnouncement } from "./MaintenanceAnnouncement";

type TabType = "changelog" | "maintenance";

const TABS: Array<{
  id: TabType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "changelog", label: "Modpack Changelog", icon: FileText },
  { id: "maintenance", label: "Maintenance", icon: Wrench },
];

export function Announcements() {
  const [activeTab, setActiveTab] = useState<TabType>("changelog");

  return (
    <div className="flex flex-1 flex-col gap-4">
      <AdminPageHeader
        trail={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Tools", href: "/admin/tools" },
          { label: "Announcements" },
        ]}
      />

      <div className="mx-auto w-full max-w-[1400px] flex flex-1 flex-col gap-6 px-4 pb-4">
        <h1 className="text-2xl font-semibold">Announcements</h1>

        <div className="overflow-x-auto border-b border-border [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex gap-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "relative flex shrink-0 cursor-pointer items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground/80",
                  )}
                >
                  <Icon className="size-3.5" />
                  {tab.label}
                  {isActive && (
                    <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {activeTab === "changelog" && <ModpackChangelog />}
        {activeTab === "maintenance" && <MaintenanceAnnouncement />}
      </div>
    </div>
  );
}
