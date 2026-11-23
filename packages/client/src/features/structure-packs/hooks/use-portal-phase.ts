import { useEffect, useRef, useState } from "react";

export const SCALE_MS = 1200;
export const CARDS_FADE_MS = 500;
export const RAMP_MS = 500;

const HERO_FADE_MS = 500;
const FRAME_MS = 16;

export type PortalPhase =
  | "closed"
  | "entering"
  | "unblurring"
  | "scaling"
  | "open"
  | "closing"
  | "shrinking"
  | "reblurring";

type TimedPhase = Exclude<PortalPhase, "closed" | "open">;

function phaseSteps(
  ambient: boolean,
): Record<TimedPhase, { next: PortalPhase; ms: number }> {
  const rampMs = ambient ? RAMP_MS : FRAME_MS;
  return {
    entering: { next: "unblurring", ms: ambient ? HERO_FADE_MS : FRAME_MS },
    unblurring: { next: "scaling", ms: rampMs },
    scaling: { next: "open", ms: SCALE_MS },
    closing: { next: "shrinking", ms: CARDS_FADE_MS },
    shrinking: { next: "reblurring", ms: SCALE_MS },
    reblurring: { next: "closed", ms: rampMs },
  };
}

export function usePortalPhase(
  open: boolean,
  ambient: boolean,
  onReblurring?: () => void,
): PortalPhase {
  const [phase, setPhase] = useState<PortalPhase>("closed");
  const onReblurringRef = useRef(onReblurring);

  useEffect(() => {
    onReblurringRef.current = onReblurring;
  }, [onReblurring]);

  if (open && phase === "closed") {
    setPhase("entering");
  } else if (!open && (phase === "open" || phase === "scaling")) {
    setPhase("closing");
  }

  useEffect(() => {
    if (phase === "closed" || phase === "open") return;
    if (phase === "reblurring") onReblurringRef.current?.();
    const step = phaseSteps(ambient)[phase];
    const id = window.setTimeout(() => setPhase(step.next), step.ms);
    return () => window.clearTimeout(id);
  }, [phase, ambient]);

  return phase;
}
