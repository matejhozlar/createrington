import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  DesignCodeError,
  parseDesignCode,
  type PlateDesign,
} from "@createrington/shared/team-tag";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToastActions } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export function LoadCodeCard({
  onLoad,
}: {
  onLoad: (design: PlateDesign) => void;
}) {
  const toast = useToastActions();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [pasted, setPasted] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = (event: React.FormEvent) => {
    event.preventDefault();
    try {
      onLoad(parseDesignCode(pasted));
      setPasted("");
      setError(null);
      setOpen(false);
      toast.success("Design loaded");
    } catch (caught) {
      if (!(caught instanceof DesignCodeError)) throw caught;
      setError(caught.message);
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls={`${id}-body`}
        className="flex min-h-14 w-full cursor-pointer items-center gap-3 px-3.5 py-3 text-left"
      >
        <span className="flex flex-1 flex-col gap-0.5">
          <span className="text-sm font-medium">Already have a code?</span>
          <span className="text-xs text-muted-foreground">
            Paste it to edit that design
          </span>
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-300 ease-in-out",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <form
          id={`${id}-body`}
          onSubmit={load}
          className="flex flex-col gap-2 px-3.5 pb-3.5"
        >
          <div className="flex gap-2">
            <Input
              value={pasted}
              onChange={(event) => {
                setPasted(event.target.value);
                setError(null);
              }}
              placeholder="CRP1:R:TAG:RRGGBB:RRGGBB"
              autoComplete="off"
              spellCheck={false}
              aria-label="Design code"
              aria-invalid={error !== null}
              aria-describedby={error ? `${id}-error` : undefined}
              className="h-10 font-mono"
            />
            <Button
              type="submit"
              variant="outline"
              disabled={!pasted.trim()}
              className="h-10"
            >
              Load
            </Button>
          </div>
          {error && (
            <p id={`${id}-error`} className="text-xs text-destructive">
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
