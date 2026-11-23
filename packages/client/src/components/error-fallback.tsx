import { Home, ArrowLeft, RefreshCw, AlertOctagon } from "lucide-react";
import { StatusPage } from "@/components/status-page";

export function ErrorFallback({
  error,
  onReset,
}: {
  error: Error | null;
  onReset: () => void;
}) {
  return (
    <StatusPage
      icon={AlertOctagon}
      tone="destructive"
      title="Something went wrong"
      badge="Error"
      description="An unexpected error occurred while rendering this page."
      detail={error?.message}
      actions={[
        {
          icon: RefreshCw,
          label: "Try again",
          description: "Re-render the page",
          onClick: onReset,
        },
        {
          icon: ArrowLeft,
          label: "Go back",
          description: "Previous page",
          onClick: () => window.history.back(),
        },
        {
          icon: Home,
          label: "Home",
          description: "Go to homepage",
          onClick: () => (window.location.href = "/"),
        },
      ]}
    />
  );
}
