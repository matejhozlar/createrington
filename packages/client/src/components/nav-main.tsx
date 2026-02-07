import { type LucideIcon } from "lucide-react";

import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuBadge,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { NavLink } from "react-router-dom";
import { Badge, IconBadge } from "./ui/badge";
import { cn } from "@/lib/utils";

export function NavMain({
  items,
}: {
  items: {
    title: string;
    url: string;
    icon?: LucideIcon;
    badge?: number;
  }[];
}) {
  const { state } = useSidebar();

  return (
    <SidebarGroup>
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem key={item.title}>
            <Tooltip>
              <TooltipTrigger asChild>
                <NavLink
                  to={item.url}
                  end={item.url === "/" || item.url === "/market"}
                >
                  {({ isActive }) => (
                    <SidebarMenuButton
                      isActive={isActive}
                      size="lg"
                      className={cn(isActive && "text-primary! bg-primary/5!")}
                    >
                      {item.icon && (
                        <div className="relative">
                          <item.icon
                            className={cn(
                              "size-6! transition-all",
                              state === "collapsed" && "ml-3",
                              isActive ? "text-primary/75!" : "text-zinc-400!",
                            )}
                          />

                          {item.badge && state === "collapsed" && <IconBadge />}
                        </div>
                      )}

                      {item.title}

                      {item.badge && (
                        <SidebarMenuBadge>
                          <Badge className="font-semibold bg-primary/90">{item.badge}</Badge>
                        </SidebarMenuBadge>
                      )}
                    </SidebarMenuButton>
                  )}
                </NavLink>
              </TooltipTrigger>

              <TooltipContent
                side="right"
                className={state === "collapsed" ? "" : "hidden"}
              >
                <p>
                  {item.badge && <span>{item.badge} </span>}
                  {item.title}
                </p>
              </TooltipContent>
            </Tooltip>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
