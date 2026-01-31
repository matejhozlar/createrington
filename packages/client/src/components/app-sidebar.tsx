"use client";

import * as React from "react";
import {
  AlertCircle,
  Coins,
  Home,
  Map,
  Shield,
  Store,
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
import { usePlayerData } from "@/contexts/socket";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user } = useAuth();
  const { toggleSidebar, open } = useSidebar();
  const isMobile = useIsMobile();

const { stats: playerStats } = usePlayerData();

const data = {
  navMain: [
    {
      title: "Home",
      url: "/",
      icon: Home,
    },
    {
      title: "Market",
      url: "/market",
      icon: Store,
      requiresAuth: true,
    },
    {
      title: "Crypto",
      url: "/crypto",
      icon: Coins,
      requiresAuth: true,
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
  ],
};

  // Filter nav items based on auth
  const filteredNavMain = data.navMain.filter(
    (item) => !item.requiresAuth || user,
  );

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <div className="flex items-center gap-2 p-2 group-data-[state=collapsed]:px-0">
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
      </SidebarHeader>

      <SidebarContent>
        <ServerStatus isCollapsed={!open} />

        <NavMain items={filteredNavMain} />
      </SidebarContent>

      <SidebarFooter>
        <NavDiscordLogin />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
