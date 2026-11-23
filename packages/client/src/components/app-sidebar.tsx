import * as React from "react";
import { X } from "lucide-react";
import {
  BookOpenIcon,
  BoxIcon,
  ClipboardIcon,
  DashboardIcon,
  DownloadIcon,
  HammerIcon,
  HeartIcon,
  HomeIcon,
  ImageIcon,
  InfoIcon,
  MapPinnedIcon,
  MessageCircleIcon,
  RocketIcon,
  ServerIcon,
  ShieldIcon,
  SquarePenIcon,
  StarIcon,
  TrophyIcon,
  UserCogIcon,
  UserPlusIcon,
  UsersIcon,
  WrenchIcon,
} from "@createrington/icons";

import { NavMain, type NavMainItem } from "@/components/nav-main";
import { NavDiscordLogin } from "@/components/nav-discord-login";
import { Logo } from "@/components/logo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth";
import { ServerStatus } from "./server-status";
import { usePlayerData } from "@/contexts/player-data";
import { NavUser } from "./nav-user";
import { NavAdmin } from "./nav-admin";
import { NavSection, type NavSectionItem } from "./nav-section";
import { trpc } from "@/lib/trpc";
import { LAUNCHER_ENABLED } from "@/lib/launcher";
import { useQuery } from "@tanstack/react-query";

type NavFeature = "workshop" | "gallery";

const OWNER_NAV: NavSectionItem[] = [
  { title: "Admins", url: "/owner/admins", icon: UserCogIcon },
  { title: "Donations", url: "/owner/donations", icon: HeartIcon },
  ...(LAUNCHER_ENABLED
    ? [
        {
          title: "Launcher",
          url: "/owner/launcher-releases",
          icon: RocketIcon,
        },
        {
          title: "Launcher packs",
          url: "/owner/launcher-packs",
          icon: BoxIcon,
        },
      ]
    : []),
];

const ADMIN_NAV: NavSectionItem[] = [
  { title: "Dashboard", url: "/admin/dashboard", icon: DashboardIcon },
  { title: "Players", url: "/admin/players", icon: UsersIcon },
  { title: "Waitlist", url: "/admin/waitlist", icon: UserPlusIcon },
  { title: "Servers", url: "/admin/servers", icon: ServerIcon },
  { title: "Workshop", url: "/admin/tools/workshop", icon: HammerIcon },
  { title: "Planning", url: "/admin/planning", icon: SquarePenIcon },
  ...(LAUNCHER_ENABLED
    ? [{ title: "Launcher", url: "/admin/launcher", icon: DownloadIcon }]
    : []),
  { title: "Tools", url: "/admin/tools", icon: WrenchIcon },
  { title: "Logs", url: "/admin/logs", icon: ClipboardIcon },
];

const MAIN_NAV: (NavMainItem & { feature?: NavFeature })[] = [
  { title: "Home", url: "/", icon: HomeIcon },
  { title: "Dimensions", url: "/structure-packs", icon: BoxIcon },
  {
    title: "Workshop",
    url: "/workshop",
    icon: HammerIcon,
    feature: "workshop",
  },
  { title: "Chat", url: "/chat", icon: MessageCircleIcon },
  { title: "Players", url: "/online-players", icon: UsersIcon },
  { title: "Map", url: "/blue-map", icon: MapPinnedIcon },
  { title: "Leaderboards", url: "/leaderboards", icon: TrophyIcon },
  { title: "Gallery", url: "/gallery", icon: ImageIcon, feature: "gallery" },
  { title: "Apply", url: "/apply-to-join", icon: UserPlusIcon },
  { title: "Team", url: "/team", icon: ShieldIcon },
  { title: "Rules", url: "/rules", icon: InfoIcon },
  { title: "Guides", url: "/guides", icon: BookOpenIcon },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user } = useAuth();
  const { toggleSidebar } = useSidebar();
  const isMobile = useIsMobile();

  const { players: onlinePlayers } = usePlayerData();

  const accountQuery = useQuery(
    trpc.user.account.me.queryOptions(undefined, {
      enabled: !!user,
    }),
  );
  const isOwner = !!user && (accountQuery.data?.isOwner ?? false);

  const workshopEnabledQuery = useQuery(
    trpc.user.workshops.isEnabled.queryOptions(undefined, { enabled: !!user }),
  );
  const workshopEnabled =
    !!user && (workshopEnabledQuery.data?.enabled ?? false);

  const galleryEnabledQuery = useQuery(
    trpc.public.gallery.isEnabled.queryOptions(),
  );
  const galleryEnabled = galleryEnabledQuery.data?.enabled ?? false;

  const features: Record<NavFeature, boolean> = {
    workshop: workshopEnabled,
    gallery: galleryEnabled,
  };
  const mainNav = MAIN_NAV.filter(
    ({ feature }) => !feature || features[feature],
  ).map((item) =>
    item.url === "/online-players" && onlinePlayers.length > 0
      ? { ...item, badge: onlinePlayers.length }
      : item,
  );

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <div className="flex items-center justify-center gap-2 p-2 group-data-[state=collapsed]:px-0">
          <Logo />

          {isMobile ? (
            <Button
              data-sidebar="trigger"
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={toggleSidebar}
            >
              <X className="size-5" />
              <span className="sr-only">Close Sidebar</span>
            </Button>
          ) : (
            <SidebarTrigger />
          )}
        </div>
        <ServerStatus />
      </SidebarHeader>

      <SidebarContent>
        <NavMain
          items={mainNav}
          prepend={
            isOwner || user?.isAdmin ? (
              <>
                {isOwner && (
                  <NavSection
                    label="Owner"
                    tooltip="Owner Panel"
                    icon={StarIcon}
                    tone="amber"
                    items={OWNER_NAV}
                  />
                )}
                {user?.isAdmin && <NavAdmin items={ADMIN_NAV} />}
              </>
            ) : undefined
          }
        />
      </SidebarContent>

      <SidebarFooter>
        {user ? <NavUser user={user} /> : <NavDiscordLogin />}
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
