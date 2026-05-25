import {
  ChevronRight,
  Eye,
  EyeOff,
  History,
  MoreHorizontal,
} from "lucide-react";
import {
  type AnimatedIcon,
  ShieldIcon,
  SparklesIcon,
  useAnimatedHover,
} from "@createrington/icons";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useAdminChat } from "@/contexts/admin-chat";

type AdminNavItem = {
  title: string;
  url: string;
  icon?: AnimatedIcon;
};

function AdminSubRow({
  item,
  isActive,
}: {
  item: AdminNavItem;
  isActive: boolean;
}) {
  const [hoverRef, hoverHandlers] = useAnimatedHover();
  const Icon = item.icon;

  return (
    <SidebarMenuSubItem {...hoverHandlers}>
      <SidebarMenuSubButton asChild>
        <NavLink
          to={item.url}
          className={cn(
            "transition-colors duration-150",
            isActive && "text-destructive bg-destructive/10",
          )}
        >
          {Icon && (
            <Icon
              ref={hoverRef}
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

function AdminSubCollapsed({
  item,
  isActive,
}: {
  item: AdminNavItem;
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
            "flex size-8 items-center justify-center rounded-md transition-colors",
            "text-destructive hover:bg-destructive/10",
            isActive && "bg-destructive/20 font-medium",
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
        <p className="text-destructive font-semibold">{item.title}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function NavAdmin({ items }: { items: AdminNavItem[] }) {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const {
    enabled: assistantEnabled,
    drawerOpen: assistantOpen,
    bubbleVisible,
    setBubbleVisible,
    toggleDrawer: toggleAssistantDrawer,
  } = useAdminChat();

  const [triggerRef, triggerHandlers] = useAnimatedHover();
  const [assistantRef, assistantHandlers] = useAnimatedHover();
  const [assistantCollapsedRef, assistantCollapsedHandlers] =
    useAnimatedHover();

  const toggleAssistant = () => {
    toggleAssistantDrawer();
    if (isMobile) setOpenMobile(false);
  };

  const openHistory = () => {
    navigate("/admin/tools/chat-history");
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
                {...triggerHandlers}
                className={cn(
                  "text-destructive hover:text-destructive hover:bg-destructive/10",
                  isAdminActive && "bg-destructive/20 font-medium",
                )}
              >
                <ShieldIcon
                  ref={triggerRef}
                  size={24}
                  className={cn(
                    "block shrink-0 transition-colors text-destructive",
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
              {items.map((item) => (
                <AdminSubRow
                  key={item.title}
                  item={item}
                  isActive={location.pathname.startsWith(item.url)}
                />
              ))}
              {assistantEnabled && (
                <SidebarMenuSubItem
                  className="group/assistant relative"
                  {...assistantHandlers}
                >
                  <SidebarMenuSubButton asChild>
                    <button
                      type="button"
                      onClick={toggleAssistant}
                      className={cn(
                        "w-full pr-8 transition-colors duration-150",
                        assistantOpen && "text-destructive bg-destructive/10",
                      )}
                    >
                      <SparklesIcon
                        ref={assistantRef}
                        size={16}
                        className="block shrink-0 transition-colors"
                      />
                      <span>Assistant</span>
                    </button>
                  </SidebarMenuSubButton>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label="Assistant options"
                        onClick={(e) => e.stopPropagation()}
                        className={cn(
                          "absolute right-1 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors",
                          "opacity-0 group-hover/assistant:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100",
                          "hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        )}
                      >
                        <MoreHorizontal className="size-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="right" align="start">
                      <DropdownMenuItem
                        onClick={() => setBubbleVisible(!bubbleVisible)}
                      >
                        {bubbleVisible ? (
                          <EyeOff className="size-4" />
                        ) : (
                          <Eye className="size-4" />
                        )}
                        {bubbleVisible ? "Hide bubble" : "Show bubble"}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={openHistory}>
                        <History className="size-4" />
                        History
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </SidebarMenuSubItem>
              )}
            </SidebarMenuSub>
          )}

          {state === "collapsed" && (
            <div className="flex flex-col gap-1 px-2 py-1">
              {items.map((item) => (
                <AdminSubCollapsed
                  key={item.title}
                  item={item}
                  isActive={location.pathname.startsWith(item.url)}
                />
              ))}
              {assistantEnabled && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={toggleAssistant}
                      {...assistantCollapsedHandlers}
                      className={cn(
                        "flex size-8 items-center justify-center rounded-md transition-colors",
                        "text-destructive hover:bg-destructive/10",
                        assistantOpen && "bg-destructive/20 font-medium",
                      )}
                    >
                      <SparklesIcon
                        ref={assistantCollapsedRef}
                        size={16}
                        className="block shrink-0 transition-colors"
                      />
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
