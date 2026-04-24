"use client";

import { cn } from "@/lib/utils";
import type { HTMLMotionProps, Variants } from "motion/react";
import { motion, useAnimation, useReducedMotion } from "motion/react";
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";

export interface ServerIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface ServerIconProps extends HTMLMotionProps<"div"> {
  size?: number;
  duration?: number;
  isAnimated?: boolean;
}

const TOP_CLOSED = "M2 2 L22 2 L22 6 L22 10 L2 10 Z";
const TOP_OPEN = "M2 2 L22 2 L14 6 L22 10 L2 10 Z";
const BOTTOM_CLOSED = "M2 14 L22 14 L22 18 L22 22 L2 22 Z";
const BOTTOM_OPEN = "M2 14 L22 14 L14 18 L22 22 L2 22 Z";

const ServerIcon = forwardRef<ServerIconHandle, ServerIconProps>(
  (
    {
      onMouseEnter,
      onMouseLeave,
      className,
      size = 24,
      duration = 1,
      isAnimated = true,
      ...props
    },
    ref,
  ) => {
    const controls = useAnimation();
    const reduced = useReducedMotion();
    const isControlled = useRef(false);

    useImperativeHandle(ref, () => {
      isControlled.current = true;
      return {
        startAnimation: () =>
          reduced ? controls.start("normal") : controls.start("animate"),
        stopAnimation: () => controls.start("normal"),
      };
    });

    const handleEnter = useCallback(
      (e?: React.MouseEvent<HTMLDivElement>) => {
        if (!isAnimated || reduced) return;
        if (!isControlled.current) controls.start("animate");
        else onMouseEnter?.(e as React.MouseEvent<HTMLDivElement>);
      },
      [controls, reduced, isAnimated, onMouseEnter],
    );

    const handleLeave = useCallback(
      (e?: React.MouseEvent<HTMLDivElement>) => {
        if (!isControlled.current) controls.start("normal");
        else onMouseLeave?.(e as React.MouseEvent<HTMLDivElement>);
      },
      [controls, onMouseLeave],
    );

    const topRackVariants: Variants = {
      normal: { d: TOP_CLOSED },
      animate: {
        d: [TOP_CLOSED, TOP_OPEN, TOP_CLOSED],
        transition: {
          duration: 0.55 * duration,
          ease: "easeInOut",
          times: [0, 0.5, 1],
        },
      },
    };

    const bottomRackVariants: Variants = {
      normal: { d: BOTTOM_CLOSED },
      animate: {
        d: [BOTTOM_CLOSED, BOTTOM_OPEN, BOTTOM_CLOSED],
        transition: {
          duration: 0.55 * duration,
          ease: "easeInOut",
          times: [0, 0.5, 1],
          delay: 0.12,
        },
      },
    };

    return (
      <motion.div
        className={cn("inline-flex items-center justify-center", className)}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        {...props}
      >
        <motion.svg
          xmlns="http://www.w3.org/2000/svg"
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          animate={controls}
          initial="normal"
        >
          <motion.path
            variants={topRackVariants}
            initial="normal"
            animate={controls}
          />
          <motion.path
            variants={bottomRackVariants}
            initial="normal"
            animate={controls}
          />
          <line x1="6" x2="6.01" y1="6" y2="6" />
          <line x1="6" x2="6.01" y1="18" y2="18" />
        </motion.svg>
      </motion.div>
    );
  },
);

ServerIcon.displayName = "ServerIcon";
export { ServerIcon };
