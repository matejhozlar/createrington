"use client";

import { BadgeCheck, ChevronsUpDown, LogOut } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth, User } from "@/contexts/auth";
import { NavLink } from "react-router-dom";

function UserSummary({
  avatarUrl,
  avatarAlt,
  avatarFallbackLetter,
  minecraftName,
  username,
  className,
}: {
  avatarUrl?: string;
  avatarAlt: string;
  avatarFallbackLetter: string;
  minecraftName?: string;
  username: string;
  className?: string;
}) {
  const { state } = useSidebar();

  return (
    <div className={"flex items-center gap-2 " + (className ?? "")}>
      <Avatar className={`size-8 rounded-lg ${state === "collapsed" ? "ml-2" : ""}`}>
        <AvatarImage src={avatarUrl} alt={avatarAlt} />

        <AvatarFallback className="rounded-lg">
          {avatarFallbackLetter}
        </AvatarFallback>
      </Avatar>

      <div className="grid flex-1 text-left text-sm leading-tight">
        <span className="truncate font-medium">{minecraftName}</span>

        <span className="truncate text-xs text-muted-foreground">
          Discord: {username}
        </span>
      </div>
    </div>
  );
}

export function NavUser({ user }: { user: User }) {
  const { isMobile } = useSidebar();
  const { logout, loading } = useAuth();

  const handleLogout = () => {
    logout();
  };

  console.log("minecraftUuid:", user.minecraftUuid, "| full user:", user);

  const crafatarAvatarUrl = user.minecraftUuid
    ? `https://mc-heads.net/avatar/${user.minecraftUuid}`
    : undefined;

  const avatarFallbackLetter = (user.minecraftUsername || user.username)
    .trim()
    .charAt(0)
    .toUpperCase();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <UserSummary
                avatarUrl={crafatarAvatarUrl}
                avatarAlt={user.minecraftUsername ?? user.username}
                avatarFallbackLetter={avatarFallbackLetter}
                minecraftName={user.minecraftUsername}
                username={user.username}
              />
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <UserSummary
                avatarUrl={crafatarAvatarUrl}
                className="px-1 py-1.5 text-left text-sm"
                avatarAlt={user.username}
                avatarFallbackLetter={avatarFallbackLetter}
                minecraftName={user.minecraftUsername}
                username={user.username}
              />
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            {user.isAdmin && (
              <>
                <DropdownMenuItem asChild>
                  <NavLink to="/admin">
                    <BadgeCheck />
                    Admin Panel
                  </NavLink>
                </DropdownMenuItem>

                <DropdownMenuSeparator />
              </>
            )}

            <DropdownMenuItem onClick={handleLogout} disabled={loading}>
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
