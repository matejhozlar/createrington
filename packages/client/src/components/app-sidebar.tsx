"use client";

import * as React from "react";
import {
  AlertCircle,
  BookOpen,
  FileText,
  Heart,
  Home,
  LayoutDashboard,
  Map,
  MessageCircle,
  Package,
  Wrench,
  Server,
  Shield,
  UserCog,
  UserPlus,
  Users,
  X,
} from "lucide-react";

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
  const isOwner = accountQuery.data?.isOwner ?? false;

  const data = {
    ownerNav: [
      {
        title: "Admins",
        url: "/owner/admins",
        icon: UserCog,
      },
    ],
    adminNav: [
      {
        title: "Dashboard",
        url: "/admin/dashboard",
        icon: LayoutDashboard,
      },
      {
        title: "Players",
        url: "/admin/players",
        icon: Users,
      },
      {
        title: "Waitlist",
        url: "/admin/waitlist",
        icon: UserPlus,
      },
      {
        title: "Servers",
        url: "/admin/servers",
        icon: Server,
      },
      {
        title: "Tools",
        url: "/admin/tools",
        icon: Wrench,
      },
      {
        title: "Donations",
        url: "/admin/donations",
        icon: Heart,
      },
      {
        title: "Logs",
        url: "/admin/logs",
        icon: FileText,
      },
    ],
    navMain: [
      {
        title: "Home",
        url: "/",
        icon: Home,
      },
      {
        title: "Packs",
        url: "/structure-packs",
        icon: Package,
      },
      {
        title: "Chat",
        url: "/chat/1",
        icon: MessageCircle,
      },
      {
        title: "Players",
        url: "/online-players",
        icon: Users,
        badge: playerStats.total > 0 ? playerStats.total : undefined,
      },
      {
        title: "Map",
        url: "/blue-map",
        icon: Map,
      },
      {
        title: "Apply",
        url: "/apply-to-join",
        icon: UserPlus,
      },
      {
        title: "Team",
        url: "/team",
        icon: Shield,
      },
      {
        title: "Rules",
        url: "/rules",
        icon: AlertCircle,
      },
      {
        title: "Guides",
        url: "/guides",
        icon: BookOpen,
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
