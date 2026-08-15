import { useNavigate } from "react-router";
import { useAuth } from "@/contexts/auth/";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DiscordIcon } from "@/components/icons/discord";
import { Home, ArrowLeft, LogIn } from "lucide-react";
import { cn } from "@/lib/utils";

export function LoginPrompt() {
  const navigate = useNavigate();
  const { login } = useAuth();

  return (
    <div className="min-h-[calc(100vh-3.5rem)] md:min-h-screen flex items-center justify-center p-6 bg-background select-none">
      <Card className="w-full max-w-xl border-border bg-card/60 backdrop-blur supports-[backdrop-filter]:bg-card/50">
        <CardHeader className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex size-10 items-center justify-center rounded-lg bg-sidebar-accent">
              <LogIn className="size-5 text-muted-foreground" />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-semibold text-foreground">
                  Login required
                </h1>
                <Badge variant="outline" className="text-muted-foreground">
                  401
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                You need to be logged in to access this page.
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={login}
              className={cn(
                "group flex items-center gap-3 rounded-lg border border-border bg-background/40 p-3 text-left",
                "transition-colors hover:bg-sidebar-accent/30 cursor-pointer",
              )}
            >
              <div className="flex size-9 items-center justify-center rounded-md bg-sidebar-accent">
                <DiscordIcon className="size-4 text-muted-foreground transition-colors group-hover:text-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Log in</p>
                <p className="text-xs text-muted-foreground">
                  Sign in with Discord
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => navigate(-1)}
              className={cn(
                "group flex items-center gap-3 rounded-lg border border-border bg-background/40 p-3 text-left",
                "transition-colors hover:bg-sidebar-accent/30 cursor-pointer",
              )}
            >
              <div className="flex size-9 items-center justify-center rounded-md bg-sidebar-accent">
                <ArrowLeft className="size-4 text-muted-foreground transition-colors group-hover:text-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Go back</p>
                <p className="text-xs text-muted-foreground">
                  Return to the previous page
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => navigate("/")}
              className={cn(
                "group flex items-center gap-3 rounded-lg border border-border bg-background/40 p-3 text-left",
                "transition-colors hover:bg-sidebar-accent/30 cursor-pointer",
              )}
            >
              <div className="flex size-9 items-center justify-center rounded-md bg-sidebar-accent">
                <Home className="size-4 text-muted-foreground transition-colors group-hover:text-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Home</p>
                <p className="text-xs text-muted-foreground">
                  Go to the homepage
                </p>
              </div>
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
