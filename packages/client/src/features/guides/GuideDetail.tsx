import { useRef, useCallback, useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router";
import { PageHeader } from "@/components/page-header";
import { guides } from "./data";
import { useGuideProgress } from "./hooks/use-guide-progress";
import { StepSidebar } from "./components/StepSidebar";
import { StepIndicator } from "./components/StepIndicator";
import { StepNavigation } from "./components/StepNavigation";
import { AutoHeight } from "./components/AutoHeight";

export function GuideDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const contentAnchorRef = useRef<HTMLDivElement>(null);
  const guide = guides.find((g) => g.slug === slug);

  const { currentStep, setCurrentStep, clearProgress } = useGuideProgress(
    slug ?? "",
  );

  const [isTransitioning, setIsTransitioning] = useState(false);

  const goToStep = useCallback(
    (step: number) => {
      if (step === currentStep) return;

      setIsTransitioning(true);

      window.setTimeout(() => {
        setCurrentStep(step);

        const el = contentAnchorRef.current;
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top < 16) {
            const top = rect.top + window.scrollY - 24;
            window.scrollTo({ top, behavior: "smooth" });
          }
        }

        requestAnimationFrame(() => setIsTransitioning(false));
      }, 200);
    },
    [currentStep, setCurrentStep],
  );

  if (!guide) {
    return <Navigate to="/guides" replace />;
  }

  const step = guide.steps[currentStep];

  const handleFinish = () => {
    navigate("/guides");
    clearProgress();
  };

  return (
    <div>
      <PageHeader
        title={guide.title}
        description={guide.description}
        imageSrc="/assets/hero/mountains-train-station.webp"
      />

      <section className="pb-12 md:py-16 px-5 md:px-8">
        <div className="max-w-7xl mx-auto" ref={contentAnchorRef}>
          <StepIndicator steps={guide.steps} currentStep={currentStep} />

          <div className="flex gap-8">
            <StepSidebar
              steps={guide.steps}
              currentStep={currentStep}
              onStepClick={goToStep}
            />

            <div className="flex-1 min-w-0 max-w-3xl">
              <AutoHeight>
                <div
                  key={currentStep}
                  style={{
                    opacity: isTransitioning ? 0 : 1,
                    transition: "opacity 200ms ease",
                  }}
                >
                  <h2 className="text-foreground text-xl md:text-2xl font-semibold">
                    {step.title}
                  </h2>
                  <p className="text-muted-foreground text-sm mt-1">
                    {step.description}
                  </p>

                  <div className="text-muted-foreground text-base/7 mt-6">
                    {step.content}
                  </div>
                </div>
              </AutoHeight>

              <StepNavigation
                currentStep={currentStep}
                totalSteps={guide.steps.length}
                onPrev={() => goToStep(currentStep - 1)}
                onNext={() => goToStep(currentStep + 1)}
                onFinish={handleFinish}
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
