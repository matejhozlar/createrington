import { useState, useCallback } from "react";
import { localStore } from "@/lib/storage";

const STORAGE_PREFIX = "guide-progress:";

export function useGuideProgress(slug: string) {
  const [currentStep, setCurrentStepState] = useState(
    () => Number(localStore.get(`${STORAGE_PREFIX}${slug}`)) || 0,
  );

  const setCurrentStep = useCallback(
    (step: number) => {
      setCurrentStepState(step);
      localStore.set(`${STORAGE_PREFIX}${slug}`, String(step));
    },
    [slug],
  );

  const clearProgress = useCallback(() => {
    setCurrentStepState(0);
    localStore.remove(`${STORAGE_PREFIX}${slug}`);
  }, [slug]);

  return { currentStep, setCurrentStep, clearProgress } as const;
}
