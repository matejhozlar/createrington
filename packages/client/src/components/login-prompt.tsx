import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/auth/";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Home, ArrowLeft, LogIn } from "lucide-react";
import { cn } from "@/lib/utils";

const DiscordIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
  </svg>
);

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
