type StepIndicatorProps = {
  steps: { title: string }[];
  currentStep: number;
};

export function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  const total = steps.length;
  const progress = total > 1 ? (currentStep / (total - 1)) * 100 : 100;
  const currentTitle = steps[currentStep]?.title;

  return (
    <div className="md:hidden pb-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
        <span>
          Step {currentStep + 1} of {total}
        </span>
        <span className="truncate max-w-[60%] text-right text-foreground/80 font-medium">
          {currentTitle}
        </span>
      </div>
      <div className="h-1 rounded-full bg-muted-foreground/15 overflow-hidden">
        <div
          className="h-full bg-primary transition-[width] duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
