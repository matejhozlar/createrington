import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Step } from "./StepHeader";

export function StepActions({
  step,
  wide,
  locked,
  onBack,
  onNext,
  onCopy,
}: {
  step: Step;
  wide: boolean;
  locked: boolean;
  onBack: () => void;
  onNext: () => void;
  onCopy: () => void;
}) {
  const last = step === 3;

  return (
    <div
      className={cn(
        "flex gap-2.5 border-t",
        wide
          ? "mt-7 pt-5"
          : "sticky bottom-0 z-30 bg-background/90 px-5 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-md",
      )}
    >
      {step > 1 && (
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={onBack}
          className="w-28"
        >
          Back
        </Button>
      )}
      <Button
        type="button"
        size="lg"
        onClick={last ? onCopy : onNext}
        disabled={locked}
        className="flex-1"
      >
        {last ? (
          <>
            <Copy />
            Copy
          </>
        ) : (
          "Next"
        )}
      </Button>
    </div>
  );
}
