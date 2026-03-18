import { cn } from "@/lib/utils";

type StepIndicatorProps = {
  steps: { title: string }[];
  currentStep: number;
  onStepClick: (index: number) => void;
};

export function StepIndicator({
  steps,
  currentStep,
  onStepClick,
}: StepIndicatorProps) {
  return (
    <div className="flex md:hidden items-center justify-center gap-2 py-2">
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;

        return (
          <button
            key={step.title}
            onClick={() => onStepClick(index)}
            className={cn(
              "size-2.5 rounded-full transition-colors",
              isCurrent && "bg-primary scale-125",
              isCompleted && "bg-primary/50",
              !isCurrent && !isCompleted && "bg-muted-foreground/30",
            )}
            aria-label={`Step ${index + 1}: ${step.title}`}
          />
        );
      })}
    </div>
  );
}
