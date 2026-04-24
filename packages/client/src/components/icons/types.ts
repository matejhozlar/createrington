import type { ComponentType, Ref } from "react";

export interface AnimatedIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

export type AnimatedIcon = ComponentType<{
  size?: number;
  duration?: number;
  isAnimated?: boolean;
  className?: string;
  ref?: Ref<AnimatedIconHandle>;
}>;
