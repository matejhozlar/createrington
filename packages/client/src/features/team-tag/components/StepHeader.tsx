import { cn } from "@/lib/utils";

export type Step = 1 | 2 | 3;

export const STEPS = [
  {
    step: 1,
    short: "Tag",
    title: "Name your party",
    description: () =>
      "Four letters or digits. Pick a starting look, you can change the colours next.",
  },
  {
    step: 2,
    short: "Colours",
    title: "Pick the colours",
    description: (wide: boolean) =>
      `The preview ${wide ? "on the left" : "above"} updates as you go. Fades are optional.`,
  },
  {
    step: 3,
    short: "Send",
    title: "Send it to an admin",
    description: () =>
      "Check it next to the team in the tab list, then copy the code.",
  },
] as const satisfies readonly {
  step: Step;
  short: string;
  title: string;
  description: (wide: boolean) => string;
}[];

export function StepHeader({
  step,
  wide,
  locked,
  onStepChange,
}: {
  step: Step;
  wide: boolean;
  locked: boolean;
  onStepChange: (step: Step) => void;
}) {
  const current = STEPS[step - 1];

  return (
    <div className="flex flex-col gap-3.5">
      <div
        role="tablist"
        aria-label="Steps"
        className="grid grid-cols-3 gap-1.5"
      >
        {STEPS.map((item) => (
          <button
            key={item.step}
            type="button"
            role="tab"
            aria-selected={item.step === step}
            aria-label={`Step ${item.step}: ${item.title}`}
            disabled={item.step > 1 && locked}
            onClick={() => onStepChange(item.step)}
            className="flex h-5 cursor-pointer items-center disabled:cursor-not-allowed"
          >
            <span
              className={cn(
                "block h-1 w-full rounded-xs transition-colors duration-200",
                item.step <= step ? "bg-primary" : "bg-muted",
              )}
            />
          </button>
        ))}
      </div>
      {wide && (
        <div className="-mt-1.5 grid grid-cols-3 gap-1.5">
          {STEPS.map((item) => (
            <button
              key={item.step}
              type="button"
              tabIndex={-1}
              disabled={item.step > 1 && locked}
              onClick={() => onStepChange(item.step)}
              className={cn(
                "cursor-pointer text-left text-xs disabled:cursor-not-allowed",
                item.step === step
                  ? "font-semibold text-foreground"
                  : "font-medium text-muted-foreground",
              )}
            >
              {item.short}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Step {step} of {STEPS.length}
        </span>
        <h2 className="text-2xl/[30px] font-bold tracking-tight">
          {current.title}
        </h2>
        <p className="mt-0.5 text-sm text-pretty text-muted-foreground">
          {current.description(wide)}
        </p>
      </div>
    </div>
  );
}
