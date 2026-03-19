import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { guides } from "./data";
import { useGuideProgress } from "./hooks/use-guide-progress";
import { StepSidebar } from "./components/StepSidebar";
import { StepIndicator } from "./components/StepIndicator";
import { StepNavigation } from "./components/StepNavigation";

export const GuideDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const guide = guides.find((g) => g.slug === slug);

  const { currentStep, setCurrentStep, clearProgress } = useGuideProgress(
    slug ?? "",
  );

  if (!guide) {
    navigate("/guides", { replace: true });
    return null;
  }

  const step = guide.steps[currentStep];

  const handleFinish = () => {
    clearProgress();
    navigate("/guides");
  };

  return (
    <div>
      <PageHeader
        title={guide.title}
        description={guide.description}
        imageSrc="/assets/hero/mountains-train-station.webp"
      />

      <section className="pb-12 md:py-16 px-5 md:px-8">
        <div className="max-w-7xl mx-auto">
          <Button variant="ghost" size="sm" asChild className="mb-4">
            <Link to="/guides">
              <ArrowLeft className="size-4" />
              Back to Guides
            </Link>
          </Button>

          <StepIndicator
            steps={guide.steps}
            currentStep={currentStep}
            onStepClick={setCurrentStep}
          />

          <div className="flex gap-8">
            <StepSidebar
              steps={guide.steps}
              currentStep={currentStep}
              onStepClick={setCurrentStep}
            />

            <div className="flex-1 min-w-0 max-w-3xl">
              <h2 className="text-foreground text-xl md:text-2xl font-semibold">
                {step.title}
              </h2>
              <p className="text-muted-foreground text-sm mt-1">
                {step.description}
              </p>

              <div className="text-muted-foreground text-base/7 mt-6">
                {step.content}
              </div>

              <StepNavigation
                currentStep={currentStep}
                totalSteps={guide.steps.length}
                onPrev={() => setCurrentStep(currentStep - 1)}
                onNext={() => setCurrentStep(currentStep + 1)}
                onFinish={handleFinish}
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
