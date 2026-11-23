import { useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router";
import { ChevronRight } from "lucide-react";
import { type AnimatedIcon, useAnimatedHover } from "@createrington/icons";
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
import { NAV_COLLAPSED_ITEM_CLASS, NAV_TONES, type NavTone } from "./nav-tones";

export type NavSectionItem = {
  title: string;
  url: string;
  icon?: AnimatedIcon;
};

function SubRow({
  item,
  tone,
  isActive,
}: {
  item: NavSectionItem;
  tone: NavTone;
  isActive: boolean;
}) {
  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton asChild>
        <NavLink
          to={item.url}
          className={cn(
            "transition-colors duration-150",
            isActive && NAV_TONES[tone].subActive,
          )}
        >
          <span>{item.title}</span>
        </NavLink>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  );
}

function SubCollapsed({
  item,
  tone,
  isActive,
}: {
  item: NavSectionItem;
  tone: NavTone;
  isActive: boolean;
}) {
  const [hoverRef, hoverHandlers] = useAnimatedHover();
  const Icon = item.icon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <NavLink
          to={item.url}
          {...hoverHandlers}
          className={cn(
            NAV_COLLAPSED_ITEM_CLASS,
            NAV_TONES[tone].collapsed,
            isActive && NAV_TONES[tone].active,
          )}
        >
          {Icon && (
            <Icon
              ref={hoverRef}
              size={16}
              className="block shrink-0 transition-colors"
            />
          )}
        </NavLink>
      </TooltipTrigger>
      <TooltipContent side="right">
        <p className={cn("font-semibold", NAV_TONES[tone].text)}>
          {item.title}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

interface NavSectionProps {
  label: string;
  tooltip: string;
  icon: AnimatedIcon;
  tone: NavTone;
  items: NavSectionItem[];
  extra?: { expanded: ReactNode; collapsed: ReactNode };
}

export function NavSection({
  label,
  tooltip,
  icon: Icon,
  tone,
  items,
  extra,
}: NavSectionProps) {
  const { state } = useSidebar();
  const { pathname } = useLocation();
  const [triggerRef, triggerHandlers] = useAnimatedHover();

  const activeUrl = items
    .map((item) => item.url)
    .filter((url) => pathname === url || pathname.startsWith(`${url}/`))
    .sort((a, b) => b.length - a.length)[0];
  const isSectionActive = activeUrl !== undefined;

  const [isOpen, setIsOpen] = useState(isSectionActive);
  const toneClasses = NAV_TONES[tone];

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} asChild>
      <SidebarMenuItem>
        <Tooltip>
          <TooltipTrigger asChild>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton
                size="lg"
                {...triggerHandlers}
                className={cn(
                  toneClasses.trigger,
                  isSectionActive && toneClasses.active,
                )}
              >
                <Icon
                  ref={triggerRef}
                  size={24}
                  className={cn(
                    "block shrink-0 transition-colors",
                    toneClasses.text,
                    state === "collapsed" && "ml-3",
                  )}
                />

                <span>{label}</span>

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
            <p className={cn("font-semibold", toneClasses.text)}>{tooltip}</p>
          </TooltipContent>
        </Tooltip>

        <CollapsibleContent className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
          {state === "expanded" && (
            <SidebarMenuSub>
              {items.map((item) => (
                <SubRow
                  key={item.title}
                  item={item}
                  tone={tone}
                  isActive={item.url === activeUrl}
                />
              ))}
              {extra?.expanded}
            </SidebarMenuSub>
          )}

          {state === "collapsed" && (
            <div className="flex flex-col gap-1 px-2 py-1">
              {items.map((item) => (
                <SubCollapsed
                  key={item.title}
                  item={item}
                  tone={tone}
                  isActive={item.url === activeUrl}
                />
              ))}
              {extra?.collapsed}
            </div>
          )}
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}
