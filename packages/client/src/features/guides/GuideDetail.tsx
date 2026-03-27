import { useRef, useState, useCallback, useEffect } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { PageHeader } from "@/components/page-header";
import { guides } from "./data";
import { useGuideProgress } from "./hooks/use-guide-progress";
import { StepSidebar } from "./components/StepSidebar";
import { StepIndicator } from "./components/StepIndicator";
import { StepNavigation } from "./components/StepNavigation";

export function GuideDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const contentRef = useRef<HTMLDivElement>(null);
  const guide = guides.find((g) => g.slug === slug);

  const { currentStep, setCurrentStep, clearProgress } = useGuideProgress(
    slug ?? "",
  );

  const [visible, setVisible] = useState(true);

  const goToStep = useCallback(
    (step: number) => {
      setVisible(false);
      setTimeout(() => {
        setCurrentStep(step);
        const el = contentRef.current;
        if (el) {
          const top = el.getBoundingClientRect().top + window.scrollY - 50;
          window.scrollTo({ top, behavior: "instant" });
        }
        setVisible(true);
      }, 150);
    },
    [setCurrentStep],
  );

  // Reset visibility when guide changes
  useEffect(() => {
    setVisible(true);
  }, [slug]);

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
        <div className="max-w-7xl mx-auto" ref={contentRef}>
          <StepIndicator
            steps={guide.steps}
            currentStep={currentStep}
            onStepClick={goToStep}
          />

          <div className="flex gap-8">
            <StepSidebar
              steps={guide.steps}
              currentStep={currentStep}
              onStepClick={goToStep}
            />

            <div className="flex-1 min-w-0 max-w-3xl">
              <div
                className="transition-opacity duration-200"
                style={{ opacity: visible ? 1 : 0 }}
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
