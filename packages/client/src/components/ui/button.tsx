/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";

const buttonVariants = cva(
  "mc-btn shrink-0 disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "mc-btn--block",
        destructive: "mc-btn--block mc-btn--destructive",
        outline: "mc-btn--block mc-btn--outline",
        secondary: "mc-btn--block mc-btn--secondary",
        success: "mc-btn--block mc-btn--success",
        warning: "mc-btn--block mc-btn--warning",
        discord: "mc-btn--block mc-btn--discord",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-9 gap-2 px-4 py-2 text-sm has-[>svg]:px-3 has-[>[data-slot=button-content]>svg]:px-3",
        xs: "h-6 gap-1 px-2 text-xs has-[>svg]:px-1.5 has-[>[data-slot=button-content]>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 px-3 text-sm has-[>svg]:px-2.5 has-[>[data-slot=button-content]>svg]:px-2.5",
        lg: "h-10 gap-2 px-6 text-sm has-[>svg]:px-4 has-[>[data-slot=button-content]>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const Button = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> &
    VariantProps<typeof buttonVariants> & {
      asChild?: boolean;
      loading?: boolean;
    }
>(
  (
    {
      className,
      variant = "default",
      size = "default",
      asChild = false,
      loading = false,
      children,
      ...props
    },
    ref,
  ) => {
    if (asChild) {
      return (
        <Slot
          data-slot="button"
          data-variant={variant}
          data-size={size}
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          {...props}
        >
          {children}
        </Slot>
      );
    }

    const { disabled, ...buttonProps } = props;

    return (
      <button
        data-slot="button"
        data-variant={variant}
        data-size={size}
        className={cn(
          buttonVariants({ variant, size, className }),
          loading && "relative",
        )}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...buttonProps}
      >
        <span
          data-slot="button-content"
          className={cn("contents", loading && "invisible")}
        >
          {children}
        </span>
        {loading && (
          <span
            data-slot="button-loading"
            className="absolute inset-0 flex items-center justify-center"
          >
            <Spinner />
          </span>
        )}
      </button>
    );
  },
);

Button.displayName = "Button";

export { Button, buttonVariants };
