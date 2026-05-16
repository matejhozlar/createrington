import { PowerOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function CryptoDisabledScreen() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <Card className="max-w-md border-primary/30">
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <div className="rounded-full bg-primary/10 p-3">
            <PowerOff className="size-7 text-primary" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-semibold">
              Crypto market temporarily disabled
            </h2>
            <p className="text-sm text-muted-foreground">
              Operators have paused the crypto market. Trading, price ticks, and
              new listings are off until it is re-enabled. Check back soon.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
