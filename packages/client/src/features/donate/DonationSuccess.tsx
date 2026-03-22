import { CheckCircle } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function DonationSuccess() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 px-5 text-center">
      <div className="flex items-center justify-center size-20 rounded-full bg-green-500/10">
        <CheckCircle className="size-10 text-green-500" />
      </div>

      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">Thank you!</h1>
        <p className="text-muted-foreground max-w-md">
          Your donation has been received. Your Supporter role will be granted
          shortly. We genuinely appreciate your support!
        </p>
        {sessionId && (
          <p className="text-xs text-muted-foreground/60 font-mono">
            ref: {sessionId}
          </p>
        )}
      </div>

      <Button asChild>
        <Link to="/">Back to home</Link>
      </Button>
    </div>
  );
}
