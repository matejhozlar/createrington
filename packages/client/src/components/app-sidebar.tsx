"use client";

import * as React from "react";
import { X } from "lucide-react";
import { HomeIcon } from "@/components/icons/home-icon";
import { BoxIcon } from "@/components/icons/box-icon";
import { MessageCircleIcon } from "@/components/icons/message-circle-icon";
import { UsersIcon } from "@/components/icons/users-icon";
import { MapPinnedIcon } from "@/components/icons/map-pinned-icon";
import { UserPlusIcon } from "@/components/icons/user-plus-icon";
import { ShieldIcon } from "@/components/icons/shield-icon";
import { InfoIcon } from "@/components/icons/info-icon";
import { BookOpenIcon } from "@/components/icons/book-open-icon";
import { UserCogIcon } from "@/components/icons/user-cog-icon";
import { DashboardIcon } from "@/components/icons/dashboard-icon";
import { ServerIcon } from "@/components/icons/server-icon";
import { WrenchIcon } from "@/components/icons/wrench-icon";
import { HeartIcon } from "@/components/icons/heart-icon";
import { ClipboardIcon } from "@/components/icons/clipboard-icon";

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
  // Gate on `user` as well — React Query keeps the previous result in the
  // cache after the query is disabled on logout, which would otherwise
  // leave the owner nav visible until the cache is cleared.
  const isOwner = !!user && (accountQuery.data?.isOwner ?? false);

  const data = {
    ownerNav: [
      {
        title: "Admins",
        url: "/owner/admins",
        icon: UserCogIcon,
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
        title: "Tools",
        url: "/admin/tools",
        icon: WrenchIcon,
      },
      {
        title: "Donations",
        url: "/admin/donations",
        icon: HeartIcon,
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
        title: "Packs",
        url: "/structure-packs",
        icon: BoxIcon,
      },
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
