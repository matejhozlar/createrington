import {
  type LucideIcon,
  ChevronDown,
  ChevronRight,
  Coins,
  History,
  TrendingUp,
  Trophy,
  Wallet,
} from "lucide-react";
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

const cryptoItems: {
  title: string;
  url: string;
  icon: LucideIcon;
  isActive: (pathname: string) => boolean;
}[] = [
  {
    title: "Overview",
    url: "/crypto",
    icon: TrendingUp,
    isActive: (pathname) => pathname === "/crypto",
  },
  {
    title: "Portfolio",
    url: "/crypto/portfolio",
    icon: Wallet,
    isActive: (pathname) => pathname.startsWith("/crypto/portfolio"),
  },
  {
    title: "Trade History",
    url: "/crypto/history",
    icon: History,
    isActive: (pathname) => pathname.startsWith("/crypto/history"),
  },
  {
    title: "Leaderboard",
    url: "/crypto/leaderboard",
    icon: Trophy,
    isActive: (pathname) => pathname.startsWith("/crypto/leaderboard"),
  },
];

export function NavCrypto() {
  const { state } = useSidebar();
  const location = useLocation();

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
                className={cn(
                  "cursor-pointer",
                  isCryptoActive && "text-primary! bg-primary/5!",
                )}
              >
                <div className="relative">
                  <Coins
                    className={cn(
                      "size-6! transition-all",
                      state === "collapsed" && "ml-3",
                      isCryptoActive ? "text-primary/75!" : "text-zinc-400!",
                    )}
                  />

                  {state === "collapsed" && (
                    <span className="absolute -right-1 -top-1 flex size-3 items-center justify-center rounded-full bg-primary ring-2 ring-background">
                      <ChevronRight
                        className={cn(
                          "size-2.5 text-white transition-transform duration-300 ease-in-out",
                          isOpen && "rotate-90",
                        )}
                      />
                    </span>
                  )}
                </div>

                <span>Crypto</span>

                <ChevronDown
                  className={cn(
                    "ml-auto size-4 transition-transform duration-300 ease-in-out",
                    isOpen && "rotate-180",
                  )}
                />
              </SidebarMenuButton>
            </CollapsibleTrigger>
          </TooltipTrigger>

          <TooltipContent
            side="right"
            className={state === "collapsed" ? "" : "hidden"}
          >
            <p className="font-semibold">Crypto Market</p>
          </TooltipContent>
        </Tooltip>

        <CollapsibleContent className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
          {state === "expanded" && (
            <SidebarMenuSub>
              {cryptoItems.map((item) => {
                const isActive = item.isActive(location.pathname);
                return (
                  <SidebarMenuSubItem key={item.title}>
                    <SidebarMenuSubButton asChild>
                      <NavLink
                        to={item.url}
                        className={cn(
                          "transition-colors duration-150 cursor-pointer",
                          isActive && "text-primary bg-primary/10",
                        )}
                      >
                        <item.icon className="size-4" />
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
              {cryptoItems.map((item) => {
                const isActive = item.isActive(location.pathname);
                return (
                  <Tooltip key={item.title}>
                    <TooltipTrigger asChild>
                      <NavLink
                        to={item.url}
                        className={cn(
                          "flex size-8 items-center justify-center rounded-md transition-colors cursor-pointer",
                          "hover:bg-primary/10",
                          isActive && "bg-primary/20 text-primary font-medium",
                        )}
                      >
                        <item.icon className="size-4" />
                      </NavLink>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p className="font-semibold">{item.title}</p>
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
