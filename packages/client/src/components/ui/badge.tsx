/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border border-transparent px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          "bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border-border text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        ghost: "[a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        link: "text-primary underline-offset-4 [a&]:hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const badgeToneVariants = cva("", {
  variants: {
    tone: {
      primary: "border-primary/20 bg-primary/10 text-primary",
      success: "border-tone-success/20 bg-tone-success/10 text-tone-success",
      warning: "border-tone-warning/20 bg-tone-warning/10 text-tone-warning",
      info: "border-tone-info/20 bg-tone-info/10 text-tone-info",
      danger: "border-destructive/20 bg-destructive/10 text-destructive",
      neutral: "border-tone-neutral/20 bg-tone-neutral/10 text-tone-neutral",
      violet: "border-violet-500/20 bg-violet-500/10 text-violet-400",
      orange: "border-orange-500/20 bg-orange-500/10 text-orange-400",
      rose: "border-rose-500/20 bg-rose-500/10 text-rose-400",
      teal: "border-teal-500/20 bg-teal-500/10 text-teal-400",
      fuchsia: "border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-400",
    },
  },
});

type BadgeTone = NonNullable<VariantProps<typeof badgeToneVariants>["tone"]>;

function Badge({
  className,
  variant = "default",
  tone,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & {
    tone?: BadgeTone;
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "span";

  return (
    <Comp
      data-slot="badge"
      data-variant={tone ? undefined : variant}
      data-tone={tone}
      className={cn(
        tone ? badgeVariants({ variant: null }) : badgeVariants({ variant }),
        tone && badgeToneVariants({ tone }),
        className,
      )}
      {...props}
    />
  );
}

const iconBadgeVariants = cva(
  "absolute rounded-full ring-2 ring-background transition-[color,box-shadow]",
  {
    variants: {
      variant: {
        default: "bg-primary",
        secondary: "bg-secondary",
        destructive: "bg-destructive",
        success: "bg-green-500",
        warning: "bg-yellow-500",
        info: "bg-blue-500",
      },
      size: {
        sm: "size-2",
        default: "size-3",
        lg: "size-4",
      },
      position: {
        "top-right": "-right-1 -top-1",
        "top-left": "-left-1 -top-1",
        "bottom-right": "-right-1 -bottom-1",
        "bottom-left": "-left-1 -bottom-1",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      position: "top-right",
    },
  },
);

function IconBadge({
  className,
  variant = "default",
  size = "default",
  position = "top-right",
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof iconBadgeVariants>) {
  return (
    <span
      data-slot="icon-badge"
      data-variant={variant}
      className={cn(iconBadgeVariants({ variant, size, position }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants, type BadgeTone, IconBadge, iconBadgeVariants };
