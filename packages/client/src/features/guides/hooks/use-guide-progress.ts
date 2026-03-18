import { useState, useCallback, useEffect } from "react";

const STORAGE_PREFIX = "guide-progress:";

export function useGuideProgress(slug: string) {
  const [currentStep, setCurrentStepState] = useState<number>(() => {
    try {
      const stored = localStorage.getItem(`${STORAGE_PREFIX}${slug}`);
      return stored ? Number(stored) : 0;
    } catch {
      return 0;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${slug}`, String(currentStep));
    } catch {
      // storage full or unavailable
    }
  }, [slug, currentStep]);

  const setCurrentStep = useCallback((step: number) => {
    setCurrentStepState(step);
  }, []);

  const clearProgress = useCallback(() => {
    try {
      localStorage.removeItem(`${STORAGE_PREFIX}${slug}`);
    } catch {
      // ignore
    }
    setCurrentStepState(0);
  }, [slug]);

  return { currentStep, setCurrentStep, clearProgress } as const;
}
