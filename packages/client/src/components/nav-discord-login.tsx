import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/auth";
import { DiscordIcon } from "@/components/icons/discord";

export function NavDiscordLogin() {
  const { state } = useSidebar();
  const { login, loading } = useAuth();

  const handleLogin = () => {
    login();
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Tooltip>
          <TooltipTrigger asChild>
            <SidebarMenuButton
              size="lg"
              onClick={handleLogin}
              disabled={loading}
              className={`bg-discord hover:bg-discord/85 text-white hover:text-white disabled:opacity-50 disabled:cursor-not-allowed ${state === "expanded" ? "justify-center" : ""}`}
            >
              <DiscordIcon
                className={`size-6! transition-all ${state === "collapsed" ? "ml-3" : ""}`}
              />
              <span>{loading ? "Loading..." : "Login with Discord"}</span>
            </SidebarMenuButton>
          </TooltipTrigger>

          <TooltipContent
            side="right"
            className={state === "collapsed" ? "" : "hidden"}
          >
            <p>Login with Discord</p>
          </TooltipContent>
        </Tooltip>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
