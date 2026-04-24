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

    const topLedVariants: Variants = {
      normal: { opacity: 1 },
      animate: {
        opacity: [1, 0.15, 1, 0.15, 1],
        transition: {
          duration: 0.9 * duration,
          ease: "easeInOut",
        },
      },
    };

    const bottomLedVariants: Variants = {
      normal: { opacity: 1 },
      animate: {
        opacity: [1, 0.15, 1, 0.15, 1],
        transition: {
          duration: 0.9 * duration,
          ease: "easeInOut",
          delay: 0.15,
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
          <rect width="20" height="8" x="2" y="2" rx="2" ry="2" />
          <rect width="20" height="8" x="2" y="14" rx="2" ry="2" />
          <motion.line
            x1="6"
            x2="6.01"
            y1="6"
            y2="6"
            variants={topLedVariants}
            initial="normal"
            animate={controls}
          />
          <motion.line
            x1="6"
            x2="6.01"
            y1="18"
            y2="18"
            variants={bottomLedVariants}
            initial="normal"
            animate={controls}
          />
        </motion.svg>
      </motion.div>
    );
  },
);

ServerIcon.displayName = "ServerIcon";
export { ServerIcon };
