"use client";

import { cn } from "@/lib/utils";
import type { HTMLMotionProps, Variants } from "motion/react";
import { motion, useAnimation, useReducedMotion } from "motion/react";
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";

export interface CoinsIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface CoinsIconProps extends HTMLMotionProps<"div"> {
  size?: number;
  duration?: number;
  isAnimated?: boolean;
}

const CoinsIcon = forwardRef<CoinsIconHandle, CoinsIconProps>(
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

    const frontCoinVariants: Variants = {
      normal: { y: 0, rotate: 0 },
      animate: {
        y: [0, -3, 0, -1, 0],
        rotate: [0, -6, 4, -2, 0],
        transition: {
          duration: 0.55 * duration,
          ease: "easeOut",
        },
      },
    };

    const backCoinVariants: Variants = {
      normal: { y: 0, rotate: 0 },
      animate: {
        y: [0, -3, 0, -1, 0],
        rotate: [0, 6, -4, 2, 0],
        transition: {
          duration: 0.55 * duration,
          ease: "easeOut",
          delay: 0.1,
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
          style={{ overflow: "visible" }}
        >
          <motion.g
            variants={frontCoinVariants}
            initial="normal"
            animate={controls}
            style={{ transformOrigin: "8px 8px" }}
          >
            <circle cx="8" cy="8" r="6" />
            <path d="M7 6h1v4" />
          </motion.g>
          <motion.g
            variants={backCoinVariants}
            initial="normal"
            animate={controls}
            style={{ transformOrigin: "16px 16px" }}
          >
            <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
            <path d="m16.71 13.88.7.71-2.82 2.82" />
          </motion.g>
        </motion.svg>
      </motion.div>
    );
  },
);

CoinsIcon.displayName = "CoinsIcon";
export { CoinsIcon };
