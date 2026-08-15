"use client";

import { Loader2 } from "lucide-react";
import {
  BadgeCheckIcon,
  ChevronsUpDownIcon,
  FileTextIcon,
  HeartIcon,
  LogoutIcon,
  SettingsIcon,
  useAnimatedHover,
} from "@createrington/icons";
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
import { useAuth, type User } from "@/contexts/auth";
import { NavLink } from "react-router";

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
  const [chevronRef, chevronHandlers] = useAnimatedHover();
  const [settingsRef, settingsHandlers] = useAnimatedHover();
  const [adminPanelRef, adminPanelHandlers] = useAnimatedHover();
  const [changelogRef, changelogHandlers] = useAnimatedHover();
  const [donateRef, donateHandlers] = useAnimatedHover();
  const [logoutHoverRef, logoutHoverHandlers] = useAnimatedHover();

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
              {...chevronHandlers}
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <TriggerSummary
                avatarUrl={crafatarAvatarUrl}
                avatarAlt={user.minecraftUsername ?? user.username}
                avatarFallbackLetter={avatarFallbackLetter}
                minecraftUsername={user.minecraftUsername}
                username={user.username}
              />
              <ChevronsUpDownIcon
                ref={chevronRef}
                size={16}
                className="ml-auto block shrink-0"
              />
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
            <DropdownMenuItem asChild {...settingsHandlers}>
              <NavLink to="/settings" className="cursor-pointer">
                <SettingsIcon
                  ref={settingsRef}
                  size={16}
                  className="block shrink-0"
                />
                Settings
              </NavLink>
            </DropdownMenuItem>

            {user.isAdmin && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs font-normal text-destructive/80">
                  Admin
                </DropdownMenuLabel>
                <DropdownMenuItem asChild {...adminPanelHandlers}>
                  <NavLink to="/admin/dashboard" className="cursor-pointer">
                    <BadgeCheckIcon
                      ref={adminPanelRef}
                      size={16}
                      className="block shrink-0 text-destructive/80"
                    />
                    Admin Panel
                  </NavLink>
                </DropdownMenuItem>
                <DropdownMenuItem asChild {...changelogHandlers}>
                  <NavLink to="/admin/changelog" className="cursor-pointer">
                    <FileTextIcon
                      ref={changelogRef}
                      size={16}
                      className="block shrink-0 text-destructive/80"
                    />
                    Changelog
                  </NavLink>
                </DropdownMenuItem>
              </>
            )}

            <DropdownMenuSeparator />

            <DropdownMenuItem asChild {...donateHandlers}>
              <NavLink to="/donate" className="cursor-pointer">
                <HeartIcon
                  ref={donateRef}
                  size={16}
                  className="block shrink-0 text-rose-400"
                />
                Donate
              </NavLink>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              variant="destructive"
              onClick={handleLogout}
              disabled={loading}
              {...logoutHoverHandlers}
              className="cursor-pointer"
            >
              {loading ? (
                <Loader2 className="animate-spin" />
              ) : (
                <LogoutIcon
                  ref={logoutHoverRef}
                  size={16}
                  className="block shrink-0"
                />
              )}
              Log out
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {user.isAdmin ? (
              <DropdownMenuItem asChild>
                <NavLink
                  to="/admin/changelog"
                  className="flex justify-center py-1 text-[0.625rem] text-muted-foreground transition-colors hover:text-foreground"
                >
                  v{__APP_VERSION__}
                </NavLink>
              </DropdownMenuItem>
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
