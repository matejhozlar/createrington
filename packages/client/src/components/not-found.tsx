import { Suspense } from "react";
import { useLocation, useNavigate, type NavigateFunction } from "react-router";
import {
  AlertTriangle,
  ArrowLeft,
  Hand,
  Home,
  Keyboard,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatusPage, STATUS_CARD_CLASS } from "@/components/status-page";
import { Kbd } from "@/components/ui/kbd";
import { useAuth } from "@/contexts/auth";
import { DEFAULT_PLAYER } from "@/lib/playerHint";
import { lazyNamed } from "@/lib/lazy";
import { cn } from "@/lib/utils";

const SkinRunner = lazyNamed(
  () => import("@/components/skin-runner"),
  "SkinRunner",
);

type Action = {
  icon: LucideIcon;
  label: string;
  description: string;
  go: (navigate: NavigateFunction) => void;
};

const ACTIONS: Action[] = [
  {
    icon: ArrowLeft,
    label: "Go back",
    description: "Return to the previous page",
    go: (navigate) => void navigate(-1),
  },
  {
    icon: Home,
    label: "Home",
    description: "Go to the homepage",
    go: (navigate) => void navigate("/"),
  },
];

const KEY_CONTROLS = [
  { keys: ["↑", "W", "Space"], action: "Jump" },
  { keys: ["↓", "S", "Shift"], action: "Slide" },
];

const TOUCH_CONTROLS = [
  { gesture: "Tap", action: "Jump" },
  { gesture: "Swipe down", action: "Slide" },
];

export function NotFound() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user } = useAuth();

  const player = user?.minecraftUuid
    ? { uuid: user.minecraftUuid, username: user.minecraftUsername }
    : DEFAULT_PLAYER;

  return (
    <StatusPage
      icon={AlertTriangle}
      title="Page not found"
      badge="404"
      description="The page you’re looking for doesn’t exist (or moved). Jump a few cacti while you’re here."
      detail={pathname}
      actions={ACTIONS.map(({ go, ...action }) => ({
        ...action,
        onClick: () => go(navigate),
      }))}
      hero={
        <Card className={cn(STATUS_CARD_CLASS, "gap-0 overflow-hidden py-0")}>
          <div className="relative h-52 sm:h-64 md:h-72">
            <Suspense
              fallback={<div className="size-full bg-sidebar-accent/40" />}
            >
              <SkinRunner uuid={player.uuid} username={player.username} />
            </Suspense>
          </div>
          <div className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
            <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 pointer-coarse:hidden">
              <li className="flex items-center gap-1.5 font-medium text-foreground">
                <Keyboard className="size-3.5" />
                Controls
              </li>
              {KEY_CONTROLS.map(({ keys, action }) => (
                <li key={action} className="flex items-center gap-1.5">
                  <span className="flex items-center gap-0.5">
                    {keys.map((key) => (
                      <Kbd key={key} className="text-foreground">
                        {key}
                      </Kbd>
                    ))}
                  </span>
                  <span>{action}</span>
                </li>
              ))}
            </ul>
            <ul className="hidden flex-wrap items-center justify-center gap-x-5 gap-y-1.5 pointer-coarse:flex">
              <li className="flex items-center gap-1.5 font-medium text-foreground">
                <Hand className="size-3.5" />
                Controls
              </li>
              {TOUCH_CONTROLS.map(({ gesture, action }) => (
                <li key={action} className="flex items-center gap-1.5">
                  <Kbd className="text-foreground">{gesture}</Kbd>
                  <span>{action}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      }
    />
  );
}
