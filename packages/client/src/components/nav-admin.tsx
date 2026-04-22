import { type LucideIcon, ChevronRight, Shield, Sparkles } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useState } from "react";
import {
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
import { useAdminChat } from "@/components/admin-chat/use-admin-chat";

export function NavAdmin({
  items,
}: {
  items: {
    title: string;
    url: string;
    icon?: LucideIcon;
  }[];
}) {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const location = useLocation();
  const {
    enabled: assistantEnabled,
    drawerOpen: assistantOpen,
    toggleDrawer: toggleAssistantDrawer,
  } = useAdminChat();

  const toggleAssistant = () => {
    toggleAssistantDrawer();
    if (isMobile) setOpenMobile(false);
  };

  const isAdminActive = items.some((item) =>
    location.pathname.startsWith(item.url),
  );

  const [isOpen, setIsOpen] = useState(isAdminActive);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} asChild>
      <SidebarMenuItem>
        <Tooltip>
          <TooltipTrigger asChild>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className={cn(
                  "text-destructive hover:text-destructive hover:bg-destructive/10",
                  isAdminActive && "bg-destructive/20 font-medium",
                )}
              >
                <Shield
                  className={cn(
                    "size-6! transition-all text-destructive",
                    state === "collapsed" && "ml-3",
                  )}
                />

                <span>Admin</span>

                {state === "expanded" && (
                  <ChevronRight
                    className={cn(
                      "ml-auto size-4 transition-transform duration-300 ease-in-out",
                      isOpen && "rotate-90",
                    )}
                  />
                )}
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

        <CollapsibleContent className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
          {state === "expanded" && (
            <SidebarMenuSub>
              {items.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname.startsWith(item.url);
                return (
                  <SidebarMenuSubItem key={item.title}>
                    <SidebarMenuSubButton asChild>
                      <NavLink
                        to={item.url}
                        className={cn(
                          "transition-colors duration-150",
                          isActive && "text-destructive bg-destructive/10",
                        )}
                      >
                        {Icon && <Icon className="size-4" />}
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                );
              })}
              {assistantEnabled && (
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton asChild>
                    <button
                      type="button"
                      onClick={toggleAssistant}
                      className={cn(
                        "w-full transition-colors duration-150",
                        assistantOpen && "text-destructive bg-destructive/10",
                      )}
                    >
                      <Sparkles className="size-4" />
                      <span>Assistant</span>
                    </button>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              )}
            </SidebarMenuSub>
          )}

          {state === "collapsed" && (
            <div className="flex flex-col gap-1 px-2 py-1">
              {items.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname.startsWith(item.url);
                return (
                  <Tooltip key={item.title}>
                    <TooltipTrigger asChild>
                      <NavLink
                        to={item.url}
                        className={cn(
                          "flex size-8 items-center justify-center rounded-md transition-colors",
                          "text-destructive hover:bg-destructive/10",
                          isActive && "bg-destructive/20 font-medium",
                        )}
                      >
                        {Icon && <Icon className="size-4" />}
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
              {assistantEnabled && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={toggleAssistant}
                      className={cn(
                        "flex size-8 items-center justify-center rounded-md transition-colors",
                        "text-destructive hover:bg-destructive/10",
                        assistantOpen && "bg-destructive/20 font-medium",
                      )}
                    >
                      <Sparkles className="size-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p className="text-destructive font-semibold">Assistant</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          )}
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}
