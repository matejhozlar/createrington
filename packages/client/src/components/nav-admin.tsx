// packages/client/src/components/nav-admin.tsx
import {
  type LucideIcon,
  ChevronDown,
  ChevronRight,
  Shield,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useState } from "react";
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function NavAdmin({
  items,
}: {
  items: {
    title: string;
    url: string;
    icon?: LucideIcon;
  }[];
}) {
  const { state } = useSidebar();
  const location = useLocation();

  // Check if we're on an admin page
  const isAdminActive = items.some((item) =>
    location.pathname.startsWith(item.url),
  );

  const [isOpen, setIsOpen] = useState(isAdminActive);

  return (
    <SidebarGroup>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <SidebarMenu>
          <SidebarMenuItem>
            <Tooltip>
              <TooltipTrigger asChild>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className={cn(
                      "text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer",
                      isAdminActive && "bg-destructive/20 font-medium",
                    )}
                  >
                    <div className="relative">
                      <Shield
                        className={cn(
                          "size-6! transition-all text-destructive",
                          state === "collapsed" && "ml-3",
                        )}
                      />

                      {/* Arrow indicator when collapsed - positioned like IconBadge */}
                      {state === "collapsed" && (
                        <span className="absolute -right-1 -top-1 flex size-3 items-center justify-center rounded-full bg-destructive ring-2 ring-background">
                          <ChevronRight
                            className={cn(
                              "size-2.5 text-white transition-transform duration-300 ease-in-out",
                              isOpen && "rotate-90",
                            )}
                          />
                        </span>
                      )}
                    </div>

                    <span>Admin</span>

                    {/* Chevron only shows when sidebar is expanded */}
                    <ChevronDown
                      className={cn(
                        "ml-auto size-4 transition-transform duration-300 ease-in-out",
                        isOpen && "rotate-180",
                      )}
                    />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
              </TooltipTrigger>

              <TooltipContent
                side="right"
                className={state === "collapsed" ? "" : "hidden"}
              >
                <p className="font-semibold text-destructive">Admin Panel</p>
              </TooltipContent>
            </Tooltip>
          </SidebarMenuItem>

          <CollapsibleContent className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
            {/* When sidebar is expanded: show as sub-menu with text */}
            {state === "expanded" && (
              <SidebarMenuSub>
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <SidebarMenuSubItem key={item.title}>
                      <SidebarMenuSubButton asChild>
                        <NavLink
                          to={item.url}
                          className={({ isActive }) =>
                            cn(
                              "transition-colors duration-150 cursor-pointer",
                              isActive && "text-destructive bg-destructive/10",
                            )
                          }
                        >
                          {Icon && <Icon className="size-4" />}
                          <span>{item.title}</span>
                        </NavLink>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  );
                })}
              </SidebarMenuSub>
            )}

            {/* When sidebar is collapsed: show as icon-only buttons */}
            {state === "collapsed" && (
              <div className="flex flex-col gap-1 px-2 py-1">
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Tooltip key={item.title}>
                      <TooltipTrigger asChild>
                        <NavLink to={item.url}>
                          {({ isActive }) => (
                            <button
                              className={cn(
                                "flex size-8 items-center justify-center rounded-md transition-colors cursor-pointer",
                                "text-destructive hover:bg-destructive/10",
                                isActive && "bg-destructive/20 font-medium",
                              )}
                            >
                              {Icon && <Icon className="size-4" />}
                            </button>
                          )}
                        </NavLink>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        <p className="text-destructive font-semibold">
                          {item.title}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            )}
          </CollapsibleContent>
        </SidebarMenu>
      </Collapsible>
    </SidebarGroup>
  );
}
