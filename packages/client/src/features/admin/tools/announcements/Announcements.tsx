import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ModpackChangelog } from "./ModpackChangelog";
import { MaintenanceAnnouncement } from "./MaintenanceAnnouncement";

export function Announcements() {
  return (
    <div className="flex flex-1 flex-col gap-4">
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
              <BreadcrumbPage>Announcements</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <div className="flex flex-1 flex-col gap-6 px-4 pb-4">
        <h1 className="text-2xl font-semibold">Announcements</h1>

        <Tabs defaultValue="changelog">
          <TabsList>
            <TabsTrigger value="changelog">Modpack Changelog</TabsTrigger>
            <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          </TabsList>

          <TabsContent value="changelog">
            <ModpackChangelog />
          </TabsContent>

          <TabsContent value="maintenance">
            <MaintenanceAnnouncement />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
