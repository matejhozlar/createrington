import { lazy, Suspense } from "react";
import { useLocation, useNavigate, type NavigateFunction } from "react-router";
import {
  AlertTriangle,
  ArrowLeft,
  Hand,
  Home,
  Keyboard,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useAuth } from "@/contexts/auth";
import { DEFAULT_PLAYER } from "@/lib/skin-runner/player-hint";
import { cn } from "@/lib/utils";

const SkinRunner = lazy(() =>
  import("@/components/skin-runner").then((m) => ({ default: m.SkinRunner })),
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
    go: (navigate) => navigate(-1),
  },
  {
    icon: Home,
    label: "Home",
    description: "Go to the homepage",
    go: (navigate) => navigate("/"),
  },
];

const CARD_CLASS =
  "border-border bg-card/60 backdrop-blur supports-[backdrop-filter]:bg-card/50";

const KBD_CLASS =
  "rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground";

const KEY_CONTROLS = [
  { key: "Space", action: "Jump" },
  { key: "↓", action: "Slide" },
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
    <div className="min-h-[calc(100vh-3.5rem)] md:min-h-screen flex items-center justify-center p-4 sm:p-6 bg-background select-none">
      <div className="w-full max-w-3xl space-y-4">
        <Card className={cn(CARD_CLASS, "gap-0 overflow-hidden py-0")}>
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
              {KEY_CONTROLS.map(({ key, action }) => (
                <li key={action} className="flex items-center gap-1.5">
                  <kbd className={KBD_CLASS}>{key}</kbd>
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
                  <kbd className={KBD_CLASS}>{gesture}</kbd>
                  <span>{action}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <Card className={CARD_CLASS}>
          <CardHeader className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex size-10 items-center justify-center rounded-lg bg-sidebar-accent">
                <AlertTriangle className="size-5 text-muted-foreground" />
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg font-semibold text-foreground">
                    Page not found
                  </h1>
                  <Badge variant="outline" className="text-muted-foreground">
                    404
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  The page you’re looking for doesn’t exist (or moved). Jump a
                  few cacti while you’re here.
                </p>
              </div>
            </div>

            <div
              className={cn(
                "rounded-lg border border-border bg-sidebar-accent/40 px-3 py-2",
                "text-sm text-muted-foreground font-mono",
              )}
            >
              {pathname}
            </div>
          </CardHeader>

          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {ACTIONS.map(({ icon: Icon, label, description, go }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => go(navigate)}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg border border-border bg-background/40 p-3 text-left",
                    "transition-colors hover:bg-sidebar-accent/30 cursor-pointer",
                  )}
                >
                  <div className="flex size-9 items-center justify-center rounded-md bg-sidebar-accent">
                    <Icon className="size-4 text-muted-foreground transition-colors group-hover:text-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {description}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
