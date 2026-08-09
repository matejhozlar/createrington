"use client";

import * as React from "react";
import { X } from "lucide-react";
import {
  BookOpenIcon,
  BoxIcon,
  ClipboardIcon,
  DashboardIcon,
  HammerIcon,
  HeartIcon,
  HomeIcon,
  InfoIcon,
  MapPinnedIcon,
  MessageCircleIcon,
  ServerIcon,
  ShieldIcon,
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
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth";
import { ServerStatus } from "./server-status";
import { usePlayerData } from "@/contexts/player-data";
import { NavUser } from "./nav-user";
import { NavAdmin } from "./nav-admin";
import { NavOwner } from "./nav-owner";
import { NavCrypto } from "./nav-crypto";
import { trpc } from "@/lib/trpc";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user } = useAuth();
  const { toggleSidebar } = useSidebar();
  const isMobile = useIsMobile();

  const { stats: playerStats } = usePlayerData();

  // Fire for any authenticated user so the owner can recover their own
  // panel even if they're momentarily not in the admin table (SQL reset,
  // bootstrap, etc.).
  const accountQuery = trpc.user.account.me.useQuery(undefined, {
    enabled: !!user,
  });
  // Gate on `user` as well: React Query keeps the previous result in the
  // cache after the query is disabled on logout, which would otherwise
  // leave the owner nav visible until the cache is cleared.
  const isOwner = !!user && (accountQuery.data?.isOwner ?? false);

  const workshopEnabledQuery = trpc.user.workshops.isEnabled.useQuery(
    undefined,
    { enabled: !!user },
  );
  const workshopEnabled =
    !!user && (workshopEnabledQuery.data?.enabled ?? false);

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
              badge: "New",
              badgeClassName: "bg-blue-500/90 text-white",
            },
          ]
        : []),
      {
        title: "Chat",
        url: "/chat/1",
        icon: MessageCircleIcon,
      },
      {
        title: "Players",
        url: "/online-players",
        icon: UsersIcon,
        badge: playerStats.total > 0 ? playerStats.total : undefined,
      },
      {
        title: "Map",
        url: "/blue-map",
        icon: MapPinnedIcon,
      },
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

  const filteredNavMain = data.navMain;

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
          items={filteredNavMain}
          prepend={
            isOwner || user?.isAdmin ? (
              <>
                {isOwner && <NavOwner items={data.ownerNav} />}
                {user?.isAdmin && <NavAdmin items={data.adminNav} />}
              </>
            ) : undefined
          }
          insertions={
            user ? [{ afterIndex: 0, element: <NavCrypto /> }] : undefined
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
