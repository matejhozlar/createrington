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
import React, { useRef } from "react";
import type {
  AnimatedIcon,
  AnimatedIconHandle,
} from "@/components/icons/types";

type NavMainItem = {
  title: string;
  url: string;
  icon?: AnimatedIcon;
  badge?: number;
};

function NavMainRow({ item }: { item: NavMainItem }) {
  const { state } = useSidebar();
  const iconRef = useRef<AnimatedIconHandle>(null);
  const Icon = item.icon;

  return (
    <SidebarMenuItem
      onMouseEnter={() => iconRef.current?.startAnimation()}
      onMouseLeave={() => iconRef.current?.stopAnimation()}
    >
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
                {Icon && (
                  <div className="relative">
                    <Icon
                      ref={iconRef}
                      size={24}
                      className={cn(
                        "block shrink-0 transition-colors",
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
                    <Badge className="font-semibold bg-primary/90">
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
  );
}

export function NavMain({
  items,
  insertions,
  prepend,
}: {
  items: NavMainItem[];
  insertions?: { afterIndex: number; element: React.ReactNode }[];
  prepend?: React.ReactNode;
}) {
  return (
    <SidebarGroup>
      <SidebarMenu>
        {prepend}
        {items.map((item, i) => (
          <React.Fragment key={item.title}>
            <NavMainRow item={item} />

            {insertions
              ?.filter((ins) => ins.afterIndex === i)
              .map((ins, j) => (
                <React.Fragment key={j}>{ins.element}</React.Fragment>
              ))}
          </React.Fragment>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
