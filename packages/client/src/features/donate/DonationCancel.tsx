import { XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function DonationCancel() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 px-5 text-center">
      <div className="flex items-center justify-center size-20 rounded-full bg-muted">
        <XCircle className="size-10 text-muted-foreground" />
      </div>

      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">Donation cancelled</h1>
        <p className="text-muted-foreground max-w-md">
          No worries — your payment was not processed. If you change your mind,
          you can always donate later.
        </p>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" asChild>
          <Link to="/">Back to home</Link>
        </Button>
        <Button asChild>
          <Link to="/donate">Try again</Link>
        </Button>
      </div>
    </div>
  );
}
