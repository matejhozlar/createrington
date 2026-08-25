import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { AdminPageTitle } from "@/features/admin/components/AdminPageTitle";
import { MaintenanceAnnouncement } from "./MaintenanceAnnouncement";

export function Announcements() {
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
        <AdminPageTitle title="Announcements" />
        <MaintenanceAnnouncement />
      </div>
    </div>
  );
}
