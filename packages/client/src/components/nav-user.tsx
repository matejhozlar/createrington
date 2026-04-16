"use client";

import {
  BadgeCheck,
  ChevronsUpDown,
  FileText,
  Heart,
  Loader2,
  LogOut,
  Settings,
} from "lucide-react";
import { mcHeadsAvatar } from "@/lib/external-urls";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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

function TriggerSummary({
  avatarUrl,
  avatarAlt,
  avatarFallbackLetter,
  minecraftUsername,
  username,
}: {
  avatarUrl?: string;
  avatarAlt: string;
  avatarFallbackLetter: string;
  minecraftUsername?: string;
  username: string;
}) {
  const { state } = useSidebar();

  return (
    <div className="flex items-center gap-2">
      <Avatar
        className={`size-8 rounded-xs ${state === "collapsed" ? "ml-2" : ""}`}
      >
        <AvatarImage src={avatarUrl} alt={avatarAlt} />

        <AvatarFallback className="rounded-lg">
          {avatarFallbackLetter}
        </AvatarFallback>
      </Avatar>

      <div className="grid flex-1 text-left text-sm leading-tight">
        <span className="truncate font-medium">{minecraftUsername}</span>

        <span className="truncate text-xs text-muted-foreground">
          Discord: {username}
        </span>
      </div>
    </div>
  );
}

/** Sidebar footer item showing the current user's avatar, name, and an account actions dropdown */
export function NavUser({ user }: { user: User }) {
  const { isMobile } = useSidebar();
  const { logout, loading } = useAuth();

  const handleLogout = () => {
    logout();
  };

  const crafatarAvatarUrl = user.minecraftUuid
    ? mcHeadsAvatar(user.minecraftUuid)
    : undefined;

  // Prefer the Minecraft username for the fallback initial; fall back to Discord username
  const avatarFallbackLetter = (user.minecraftUsername || user.username)
    .trim()
    .charAt(0)
    .toUpperCase();

  const displayName = user.minecraftUsername ?? user.username;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <TriggerSummary
                avatarUrl={crafatarAvatarUrl}
                avatarAlt={user.minecraftUsername ?? user.username}
                avatarFallbackLetter={avatarFallbackLetter}
                minecraftUsername={user.minecraftUsername}
                username={user.username}
              />
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="w-64 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuItem
              asChild
              className="focus:bg-accent flex-col items-start gap-0.5 py-2"
            >
              <NavLink to="/settings" className="cursor-pointer">
                <div className="flex w-full items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    Signed in as
                  </span>
                  <Badge
                    variant={user.isAdmin ? "destructive" : "secondary"}
                    className="ml-auto h-4 px-1.5 text-[0.625rem] font-semibold"
                  >
                    {user.isAdmin ? "Admin" : "Member"}
                  </Badge>
                </div>
                <span className="truncate text-sm font-medium">
                  {displayName}
                </span>
              </NavLink>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              Account
            </DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <NavLink to="/settings" className="cursor-pointer">
                <Settings />
                Settings
              </NavLink>
            </DropdownMenuItem>

            {user.isAdmin && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs font-normal text-destructive/80">
                  Admin
                </DropdownMenuLabel>
                <DropdownMenuItem asChild>
                  <NavLink to="/admin/dashboard" className="cursor-pointer">
                    <BadgeCheck className="text-destructive/80" />
                    Admin Panel
                  </NavLink>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <NavLink to="/admin/changelog" className="cursor-pointer">
                    <FileText className="text-destructive/80" />
                    Changelog
                  </NavLink>
                </DropdownMenuItem>
              </>
            )}

            <DropdownMenuSeparator />

            <DropdownMenuItem asChild>
              <NavLink to="/donate" className="cursor-pointer">
                <Heart className="text-rose-400" />
                Donate
              </NavLink>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              variant="destructive"
              onClick={handleLogout}
              disabled={loading}
              className="cursor-pointer"
            >
              {loading ? <Loader2 className="animate-spin" /> : <LogOut />}
              Log out
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {user.isAdmin ? (
              <NavLink
                to="/admin/changelog"
                className="block py-1 text-center text-[0.625rem] text-muted-foreground transition-colors hover:text-foreground"
              >
                v{__APP_VERSION__}
              </NavLink>
            ) : (
              <div className="py-1 text-center text-[0.625rem] text-muted-foreground">
                v{__APP_VERSION__}
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
