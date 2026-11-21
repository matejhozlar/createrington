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
  TrophyIcon,
  UserCogIcon,
  UserPlusIcon,
  UsersIcon,
  WrenchIcon,
} from "@createrington/icons";

import { NavMain } from "@/components/nav-main";
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
import { NavOwner } from "./nav-owner";
import { trpc } from "@/lib/trpc";
import { LAUNCHER_ENABLED } from "@/lib/launcher";
import { useQuery } from "@tanstack/react-query";

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

  const data = {
    ownerNav: [
      {
        title: "Admins",
        url: "/owner/admins",
        icon: UserCogIcon,
      },
      {
        title: "Donations",
        url: "/owner/donations",
        icon: HeartIcon,
      },
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
    ],
    adminNav: [
      {
        title: "Dashboard",
        url: "/admin/dashboard",
        icon: DashboardIcon,
      },
      {
        title: "Players",
        url: "/admin/players",
        icon: UsersIcon,
      },
      {
        title: "Waitlist",
        url: "/admin/waitlist",
        icon: UserPlusIcon,
      },
      {
        title: "Servers",
        url: "/admin/servers",
        icon: ServerIcon,
      },
      {
        title: "Workshop",
        url: "/admin/tools/workshop",
        icon: HammerIcon,
      },
      {
        title: "Planning",
        url: "/admin/planning",
        icon: SquarePenIcon,
      },
      ...(LAUNCHER_ENABLED
        ? [
            {
              title: "Launcher",
              url: "/admin/launcher",
              icon: DownloadIcon,
            },
          ]
        : []),
      {
        title: "Tools",
        url: "/admin/tools",
        icon: WrenchIcon,
      },
      {
        title: "Logs",
        url: "/admin/logs",
        icon: ClipboardIcon,
      },
    ],
    navMain: [
      {
        title: "Home",
        url: "/",
        icon: HomeIcon,
      },
      {
        title: "Dimensions",
        url: "/structure-packs",
        icon: BoxIcon,
      },
      ...(workshopEnabled
        ? [
            {
              title: "Workshop",
              url: "/workshop",
              icon: HammerIcon,
            },
          ]
        : []),
      {
        title: "Chat",
        url: "/chat",
        icon: MessageCircleIcon,
      },
      {
        title: "Players",
        url: "/online-players",
        icon: UsersIcon,
        badge: onlinePlayers.length > 0 ? onlinePlayers.length : undefined,
      },
      {
        title: "Map",
        url: "/blue-map",
        icon: MapPinnedIcon,
      },
      {
        title: "Leaderboards",
        url: "/leaderboards",
        icon: TrophyIcon,
      },
      ...(galleryEnabled
        ? [
            {
              title: "Gallery",
              url: "/gallery",
              icon: ImageIcon,
            },
          ]
        : []),
      {
        title: "Apply",
        url: "/apply-to-join",
        icon: UserPlusIcon,
      },
      {
        title: "Team",
        url: "/team",
        icon: ShieldIcon,
      },
      {
        title: "Rules",
        url: "/rules",
        icon: InfoIcon,
      },
      {
        title: "Guides",
        url: "/guides",
        icon: BookOpenIcon,
      },
    ],
  };

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
          items={data.navMain}
          prepend={
            isOwner || user?.isAdmin ? (
              <>
                {isOwner && <NavOwner items={data.ownerNav} />}
                {user?.isAdmin && <NavAdmin items={data.adminNav} />}
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
