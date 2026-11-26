import { useState, useCallback } from "react";
import { localStore } from "@/lib/storage";

const STORAGE_PREFIX = "guide-progress:";

function toStepIndex(value: number, stepCount: number): number {
  const step = Number.isInteger(value) ? value : 0;
  return Math.min(Math.max(0, step), Math.max(0, stepCount - 1));
}

export function useGuideProgress(slug: string, stepCount: number) {
  const [storedStep, setCurrentStepState] = useState(() =>
    Number(localStore.get(`${STORAGE_PREFIX}${slug}`)),
  );
  const currentStep = toStepIndex(storedStep, stepCount);

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
