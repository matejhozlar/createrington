import { Eye, EyeOff, History, MoreHorizontal } from "lucide-react";
import {
  ShieldIcon,
  SparklesIcon,
  useAnimatedHover,
} from "@createrington/icons";
import { useNavigate } from "react-router";
import {
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  useSidebar,
} from "@/components/ui/sidebar";
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
import { NavSection, type NavSectionItem } from "@/components/nav-section";
import { NAV_COLLAPSED_ITEM_CLASS, NAV_TONES } from "@/components/nav-tones";
import { cn } from "@/lib/utils";
import { useAdminChat } from "@/contexts/admin-chat";

const TONE = NAV_TONES.destructive;

function AssistantRow({ onToggle }: { onToggle: () => void }) {
  const { isMobile, setOpenMobile } = useSidebar();
  const navigate = useNavigate();
  const { drawerOpen, bubbleVisible, setBubbleVisible } = useAdminChat();

  const openHistory = () => {
    void navigate("/admin/tools/chat-history");
    if (isMobile) setOpenMobile(false);
  };

  return (
    <SidebarMenuSubItem className="group/assistant relative">
      <SidebarMenuSubButton asChild>
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            "w-full pr-8 transition-colors duration-150",
            drawerOpen && TONE.subActive,
          )}
        >
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
          <DropdownMenuItem onClick={() => setBubbleVisible(!bubbleVisible)}>
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
  );
}

function AssistantCollapsed({ onToggle }: { onToggle: () => void }) {
  const { drawerOpen } = useAdminChat();
  const [hoverRef, hoverHandlers] = useAnimatedHover();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onToggle}
          {...hoverHandlers}
          className={cn(
            NAV_COLLAPSED_ITEM_CLASS,
            TONE.collapsed,
            drawerOpen && TONE.active,
          )}
        >
          <SparklesIcon
            ref={hoverRef}
            size={16}
            className="block shrink-0 transition-colors"
          />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">
        <p className={cn("font-semibold", TONE.text)}>Assistant</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function NavAdmin({ items }: { items: NavSectionItem[] }) {
  const { isMobile, setOpenMobile } = useSidebar();
  const { enabled, toggleDrawer } = useAdminChat();

  const toggleAssistant = () => {
    toggleDrawer();
    if (isMobile) setOpenMobile(false);
  };

  return (
    <NavSection
      label="Admin"
      tooltip="Admin Panel"
      icon={ShieldIcon}
      tone="destructive"
      items={items}
      extra={
        enabled
          ? {
              expanded: <AssistantRow onToggle={toggleAssistant} />,
              collapsed: <AssistantCollapsed onToggle={toggleAssistant} />,
            }
          : undefined
      }
    />
  );
}
