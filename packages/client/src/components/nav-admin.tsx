// Alternative nav-admin.tsx
import { type LucideIcon, ChevronDown, Shield } from "lucide-react";
import { NavLink } from "react-router-dom";
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
  const [isOpen, setIsOpen] = useState(false);

  // Check if we're on an admin page
  const isAdminActive = items.some((item) =>
    window.location.pathname.startsWith(item.url),
  );

  // When collapsed, show as individual icon buttons
  if (state === "collapsed") {
    return (
      <SidebarGroup>
        <SidebarMenu>
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <SidebarMenuItem key={item.title}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <NavLink to={item.url}>
                      {({ isActive }) => (
                        <SidebarMenuButton
                          size="lg"
                          isActive={isActive}
                          className={cn(
                            "text-destructive hover:text-destructive hover:bg-destructive/10",
                            isActive && "bg-destructive/20 font-medium",
                          )}
                        >
                          <div className="relative">
                            {Icon && (
                              <Icon className="size-6! ml-3 text-destructive transition-all" />
                            )}
                          </div>
                          <span>{item.title}</span>
                        </SidebarMenuButton>
                      )}
                    </NavLink>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p className="text-destructive font-semibold">
                      {item.title}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroup>
    );
  }

  // When expanded, show as collapsible section
  return (
    <SidebarGroup>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <SidebarMenu>
          <SidebarMenuItem>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className={cn(
                  "text-destructive hover:text-destructive hover:bg-destructive/10",
                  isAdminActive && "bg-destructive/20 font-medium",
                )}
              >
                <Shield className="size-6! text-destructive transition-all" />
                <span>Admin</span>
                <ChevronDown
                  className={cn(
                    "ml-auto size-4 transition-transform duration-300 ease-in-out",
                    isOpen && "rotate-180",
                  )}
                />
              </SidebarMenuButton>
            </CollapsibleTrigger>
          </SidebarMenuItem>

          <CollapsibleContent className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
            <SidebarMenuSub>
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <SidebarMenuSubItem key={item.title}>
                    <NavLink to={item.url}>
                      {({ isActive }) => (
                        <SidebarMenuSubButton
                          isActive={isActive}
                          className={cn(
                            "transition-colors duration-150",
                            isActive && "text-destructive bg-destructive/10",
                          )}
                        >
                          {Icon && <Icon className="size-4" />}
                          <span>{item.title}</span>
                        </SidebarMenuSubButton>
                      )}
                    </NavLink>
                  </SidebarMenuSubItem>
                );
              })}
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenu>
      </Collapsible>
    </SidebarGroup>
  );
}
