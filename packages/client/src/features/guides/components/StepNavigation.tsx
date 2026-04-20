import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

type StepNavigationProps = {
  currentStep: number;
  totalSteps: number;
  onPrev: () => void;
  onNext: () => void;
  onFinish: () => void;
};

export function StepNavigation({
  currentStep,
  totalSteps,
  onPrev,
  onNext,
  onFinish,
}: StepNavigationProps) {
  const isFirst = currentStep === 0;
  const isLast = currentStep === totalSteps - 1;

  return (
    <div className="mt-10 pt-6 border-t border-border/60 flex items-center justify-between gap-3">
      <Button
        variant="ghost"
        onClick={onPrev}
        disabled={isFirst}
        className="gap-1"
      >
        <ChevronLeft className="size-4" />
        Previous
      </Button>

      <span className="text-xs text-muted-foreground tabular-nums hidden sm:block">
        Step {currentStep + 1} of {totalSteps}
      </span>

      {isLast ? (
        <Button onClick={onFinish} className="gap-1">
          <Check className="size-4" />
          Finish
        </Button>
      ) : (
        <Button onClick={onNext} className="gap-1">
          Next
          <ChevronRight className="size-4" />
        </Button>
      )}
    </div>
  );
}
