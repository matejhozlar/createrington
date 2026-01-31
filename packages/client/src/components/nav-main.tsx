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
                    <SidebarMenuButton isActive={isActive} size="lg">
                      {item.icon && (
                        <div className="relative">
                          <item.icon
                            className={`size-6! transition-all ${state === "collapsed" ? "ml-1" : ""}`}
                          />
                          
                          {item.badge && state === "collapsed" && (
                            <IconBadge />
                          )}
                        </div>
                      )}

                      {item.title}
                      
                      {item.badge && (
                        <SidebarMenuBadge>
                          <Badge>
                            {item.badge}
                          </Badge>
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
