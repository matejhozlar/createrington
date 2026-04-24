import { ChevronRight } from "lucide-react";
import { StarIcon } from "@createrington/icons";
import { NavLink, useLocation } from "react-router-dom";
import { useRef, useState } from "react";
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
import type { AnimatedIcon, AnimatedIconHandle } from "@createrington/icons";

type OwnerNavItem = {
  title: string;
  url: string;
  icon?: AnimatedIcon;
};

function OwnerSubRow({
  item,
  isActive,
}: {
  item: OwnerNavItem;
  isActive: boolean;
}) {
  const iconRef = useRef<AnimatedIconHandle>(null);
  const Icon = item.icon;

  return (
    <SidebarMenuSubItem
      onMouseEnter={() => iconRef.current?.startAnimation()}
      onMouseLeave={() => iconRef.current?.stopAnimation()}
    >
      <SidebarMenuSubButton asChild>
        <NavLink
          to={item.url}
          className={cn(
            "transition-colors duration-150",
            isActive && "text-amber-500 bg-amber-500/10",
          )}
        >
          {Icon && (
            <Icon
              ref={iconRef}
              size={16}
              className="block shrink-0 transition-colors"
            />
          )}
          <span>{item.title}</span>
        </NavLink>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  );
}

function OwnerSubCollapsed({
  item,
  isActive,
}: {
  item: OwnerNavItem;
  isActive: boolean;
}) {
  const iconRef = useRef<AnimatedIconHandle>(null);
  const Icon = item.icon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <NavLink
          to={item.url}
          onMouseEnter={() => iconRef.current?.startAnimation()}
          onMouseLeave={() => iconRef.current?.stopAnimation()}
          className={cn(
            "flex size-8 items-center justify-center rounded-md transition-colors",
            "text-amber-500 hover:bg-amber-500/10",
            isActive && "bg-amber-500/20 font-medium",
          )}
        >
          {Icon && (
            <Icon
              ref={iconRef}
              size={16}
              className="block shrink-0 transition-colors"
            />
          )}
        </NavLink>
      </TooltipTrigger>
      <TooltipContent side="right">
        <p className="font-semibold text-amber-500">{item.title}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function NavOwner({ items }: { items: OwnerNavItem[] }) {
  const { state } = useSidebar();
  const location = useLocation();
  const triggerIconRef = useRef<AnimatedIconHandle>(null);

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
                onMouseEnter={() => triggerIconRef.current?.startAnimation()}
                onMouseLeave={() => triggerIconRef.current?.stopAnimation()}
                className={cn(
                  "text-amber-500 hover:text-amber-500 hover:bg-amber-500/10",
                  isOwnerActive && "bg-amber-500/20 font-medium",
                )}
              >
                <StarIcon
                  ref={triggerIconRef}
                  size={24}
                  className={cn(
                    "block shrink-0 transition-colors text-amber-500",
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
              {items.map((item) => (
                <OwnerSubRow
                  key={item.title}
                  item={item}
                  isActive={location.pathname.startsWith(item.url)}
                />
              ))}
            </SidebarMenuSub>
          )}

          {state === "collapsed" && (
            <div className="flex flex-col gap-1 px-2 py-1">
              {items.map((item) => (
                <OwnerSubCollapsed
                  key={item.title}
                  item={item}
                  isActive={location.pathname.startsWith(item.url)}
                />
              ))}
            </div>
          )}
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}
