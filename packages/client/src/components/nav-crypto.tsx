import { ChevronRight } from "lucide-react";
import {
  type AnimatedIcon,
  CoinsIcon,
  HistoryIcon,
  TrendingUpIcon,
  TrophyIcon,
  WalletIcon,
  useAnimatedHover,
} from "@createrington/icons";
import { NavLink, useLocation } from "react-router";
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

type CryptoNavItem = {
  title: string;
  url: string;
  icon: AnimatedIcon;
  isActive: (pathname: string) => boolean;
};

const cryptoItems: CryptoNavItem[] = [
  {
    title: "Overview",
    url: "/crypto",
    icon: TrendingUpIcon,
    isActive: (pathname) => pathname === "/crypto",
  },
  {
    title: "Portfolio",
    url: "/crypto/portfolio",
    icon: WalletIcon,
    isActive: (pathname) => pathname.startsWith("/crypto/portfolio"),
  },
  {
    title: "History",
    url: "/crypto/history",
    icon: HistoryIcon,
    isActive: (pathname) => pathname.startsWith("/crypto/history"),
  },
  {
    title: "Leaderboard",
    url: "/crypto/leaderboard",
    icon: TrophyIcon,
    isActive: (pathname) => pathname.startsWith("/crypto/leaderboard"),
  },
];

function CryptoSubRow({
  item,
  isActive,
}: {
  item: CryptoNavItem;
  isActive: boolean;
}) {
  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton asChild>
        <NavLink
          to={item.url}
          className={cn(
            "transition-colors duration-150 cursor-pointer",
            isActive && "text-primary bg-primary/10",
          )}
        >
          <span>{item.title}</span>
        </NavLink>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  );
}

function CryptoSubCollapsed({
  item,
  isActive,
}: {
  item: CryptoNavItem;
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
            "flex size-8 items-center justify-center rounded-md transition-colors cursor-pointer",
            "hover:bg-primary/10",
            isActive && "bg-primary/20 text-primary font-medium",
          )}
        >
          <Icon
            ref={hoverRef}
            size={16}
            className="block shrink-0 transition-colors"
          />
        </NavLink>
      </TooltipTrigger>
      <TooltipContent side="right">
        <p className="font-semibold">{item.title}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function NavCrypto() {
  const { state } = useSidebar();
  const location = useLocation();
  const [triggerRef, triggerHandlers] = useAnimatedHover();

  const isCryptoActive = location.pathname.startsWith("/crypto");

  const [isOpen, setIsOpen] = useState(isCryptoActive);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} asChild>
      <SidebarMenuItem>
        <Tooltip>
          <TooltipTrigger asChild>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton
                size="lg"
                isActive={isCryptoActive}
                {...triggerHandlers}
                className={cn(
                  "cursor-pointer",
                  isCryptoActive && "text-primary! bg-primary/5!",
                )}
              >
                <CoinsIcon
                  ref={triggerRef}
                  size={24}
                  className={cn(
                    "block shrink-0 transition-colors",
                    state === "collapsed" && "ml-3",
                    isCryptoActive ? "text-primary/75!" : "text-zinc-400!",
                  )}
                />

                <span>Crypto</span>

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
            <p className="font-semibold">Crypto</p>
          </TooltipContent>
        </Tooltip>

        <CollapsibleContent className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
          {state === "expanded" && (
            <SidebarMenuSub>
              {cryptoItems.map((item) => (
                <CryptoSubRow
                  key={item.title}
                  item={item}
                  isActive={item.isActive(location.pathname)}
                />
              ))}
            </SidebarMenuSub>
          )}

          {state === "collapsed" && (
            <div className="flex flex-col gap-1 px-2 py-1">
              {cryptoItems.map((item) => (
                <CryptoSubCollapsed
                  key={item.title}
                  item={item}
                  isActive={item.isActive(location.pathname)}
                />
              ))}
            </div>
          )}
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}
