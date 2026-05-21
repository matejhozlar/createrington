import * as React from "react";
import { Slot } from "@radix-ui/react-slot";

import { cn } from "@/lib/utils";

const VARIANT_CLASS = {
  stone: "",
  obsidian: "mc-btn--obsidian",
  gold: "mc-btn--gold",
  grass: "mc-btn--grass",
  tnt: "mc-btn--tnt",
} as const;

const SIZE_CLASS = {
  sm: "h-8 px-3 text-xs [&_svg]:size-3.5",
  default: "h-10 px-4 text-sm [&_svg]:size-4",
  lg: "h-12 px-6 text-base [&_svg]:size-5",
} as const;

export type MinecraftButtonVariant = keyof typeof VARIANT_CLASS;
export type MinecraftButtonSize = keyof typeof SIZE_CLASS;

export interface MinecraftButtonProps extends React.ComponentProps<"button"> {
  variant?: MinecraftButtonVariant;
  size?: MinecraftButtonSize;
  asChild?: boolean;
}

export const MinecraftButton = React.forwardRef<
  HTMLButtonElement,
  MinecraftButtonProps
>(
  (
    {
      className,
      variant = "stone",
      size = "default",
      asChild = false,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";

    return (
      <Comp
        ref={ref}
        className={cn(
          "mc-btn [&_svg]:shrink-0",
          VARIANT_CLASS[variant],
          SIZE_CLASS[size],
          className,
        )}
        {...props}
      />
    );
  },
);

MinecraftButton.displayName = "MinecraftButton";
