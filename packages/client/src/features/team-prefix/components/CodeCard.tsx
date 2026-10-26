import { useId, useState } from "react";
import { Copy } from "lucide-react";
import {
  DesignCodeError,
  parseDesignCode,
  type PlateDesign,
} from "@createrington/shared/team-prefix";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToastActions } from "@/hooks/use-toast";

const STEPS = [
  "Copy your code.",
  "Give your Team Prefix License to an admin in game.",
  "Send them the code. They set it for your party, and every member gets the plate.",
];

export function CodeCard({
  code,
  onLoad,
}: {
  code: string | null;
  onLoad: (design: PlateDesign) => void;
}) {
  const toast = useToastActions();
  const inputId = useId();
  const [pasted, setPasted] = useState("");
  const [error, setError] = useState<string | null>(null);

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Clipboard access was blocked by the browser");
    }
  };

  const load = (event: React.FormEvent) => {
    event.preventDefault();
    try {
      onLoad(parseDesignCode(pasted));
      setPasted("");
      setError(null);
      toast.success("Design loaded");
    } catch (caught) {
      if (!(caught instanceof DesignCodeError)) throw caught;
      setError(caught.message);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Your design code</CardTitle>
        <CardDescription>
          The code is your whole design. An admin pastes it on the server.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
          <output
            aria-live="polite"
            className="flex min-h-11 min-w-0 flex-1 items-center rounded-md border bg-muted/40 px-3 font-mono text-base break-all select-all"
          >
            {code ?? (
              <span className="font-sans text-sm text-muted-foreground">
                Finish the tag to get your code.
              </span>
            )}
          </output>
          <Button
            type="button"
            variant="outline"
            onClick={copy}
            disabled={!code}
            className="h-11 sm:px-5"
          >
            <Copy />
            Copy
          </Button>
        </div>

        <ol className="flex flex-col gap-2 text-sm">
          {STEPS.map((step, i) => (
            <li key={step} className="flex gap-3">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                {i + 1}
              </span>
              <span className="text-muted-foreground">{step}</span>
            </li>
          ))}
        </ol>

        <Separator />

        <form onSubmit={load} className="flex flex-col gap-1.5">
          <Label htmlFor={inputId} className="text-sm font-medium">
            Edit an existing code
          </Label>
          <div className="flex gap-2">
            <Input
              id={inputId}
              value={pasted}
              onChange={(event) => {
                setPasted(event.target.value);
                setError(null);
              }}
              placeholder="CRP1:R:TAG:RRGGBB:RRGGBB"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={error !== null}
              aria-describedby={error ? `${inputId}-error` : undefined}
              className="font-mono"
            />
            <Button type="submit" variant="outline" disabled={!pasted.trim()}>
              Load
            </Button>
          </div>
          {error && (
            <p id={`${inputId}-error`} className="text-xs text-destructive">
              {error}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
