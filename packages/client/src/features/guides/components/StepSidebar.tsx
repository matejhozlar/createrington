import { Link } from "react-router-dom";
import { ArrowLeft, Check } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type StepSidebarProps = {
  steps: { title: string }[];
  currentStep: number;
  onStepClick: (index: number) => void;
};

export function StepSidebar({
  steps,
  currentStep,
  onStepClick,
}: StepSidebarProps) {
  return (
    <nav className="hidden md:block w-56 shrink-0">
      <ul className="flex flex-col gap-1 sticky top-4">
        <li>
          <Link
            to="/guides"
            className="flex items-center gap-2 w-full rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-3.5 shrink-0" />
            <span>Back to Guides</span>
          </Link>
        </li>
        <li>
          <Separator className="my-1" />
        </li>
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;

          return (
            <li key={step.title}>
              <button
                onClick={() => onStepClick(index)}
                className={cn(
                  "flex items-center gap-3 w-full rounded-md px-3 py-2 text-sm text-left transition-colors",
                  isCurrent && "bg-primary/10 text-primary font-medium",
                  isCompleted && "text-muted-foreground",
                  !isCurrent &&
                    !isCompleted &&
                    "text-muted-foreground/60 hover:text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex items-center justify-center size-6 rounded-full text-xs shrink-0 border",
                    isCurrent &&
                      "border-primary bg-primary text-primary-foreground",
                    isCompleted &&
                      "border-primary/50 bg-primary/10 text-primary",
                    !isCurrent && !isCompleted && "border-muted-foreground/30",
                  )}
                >
                  {isCompleted ? <Check className="size-3" /> : index + 1}
                </span>
                <span className="truncate">{step.title}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
