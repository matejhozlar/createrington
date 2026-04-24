import { type LucideIcon, ChevronRight, Crown } from "lucide-react";
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

export function NavOwner({
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

  const isOwnerActive = items.some((item) =>
    location.pathname.startsWith(item.url),
  );
  const [isOpen, setIsOpen] = useState(isOwnerActive);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} asChild>
      <SidebarMenuItem>
        <Tooltip>
          <TooltipTrigger asChild>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className={cn(
                  "text-amber-500 hover:text-amber-500 hover:bg-amber-500/10",
                  isOwnerActive && "bg-amber-500/20 font-medium",
                )}
              >
                <Crown
                  className={cn(
                    "size-6! transition-all text-amber-500",
                    state === "collapsed" && "ml-3",
                  )}
                />

                <span>Owner</span>

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
            <p className="font-semibold text-amber-500">Owner Panel</p>
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
                          isActive && "text-amber-500 bg-amber-500/10",
                        )}
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
                          "text-amber-500 hover:bg-amber-500/10",
                          isActive && "bg-amber-500/20 font-medium",
                        )}
                      >
                        {Icon && <Icon className="size-4" />}
                      </NavLink>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p className="font-semibold text-amber-500">
                        {item.title}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          )}
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}
