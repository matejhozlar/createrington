import { ChevronLeft, ChevronRight } from "lucide-react";
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
    <div className="flex items-center justify-between pt-6">
      <Button
        variant="outline"
        onClick={onPrev}
        disabled={isFirst}
        className="gap-1"
      >
        <ChevronLeft className="size-4" />
        Previous
      </Button>

      <span className="text-sm text-muted-foreground">
        {currentStep + 1} / {totalSteps}
      </span>

      {isLast ? (
        <Button onClick={onFinish}>Finish</Button>
      ) : (
        <Button onClick={onNext} className="gap-1">
          Next
          <ChevronRight className="size-4" />
        </Button>
      )}
    </div>
  );
}
