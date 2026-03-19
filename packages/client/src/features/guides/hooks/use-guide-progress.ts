import { useState, useCallback } from "react";

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

  const setCurrentStep = useCallback(
    (step: number) => {
      setCurrentStepState(step);
      try {
        localStorage.setItem(`${STORAGE_PREFIX}${slug}`, String(step));
      } catch {
        // storage full or unavailable
      }
    },
    [slug],
  );

  const clearProgress = useCallback(() => {
    try {
      localStorage.removeItem(`${STORAGE_PREFIX}${slug}`);
    } catch {
      // ignore
    }
  }, [slug]);

  return { currentStep, setCurrentStep, clearProgress } as const;
}
