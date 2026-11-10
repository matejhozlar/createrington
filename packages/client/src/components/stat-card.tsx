import { cva, type VariantProps } from "class-variance-authority";
import type { LucideIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";

const iconVariants = cva(
  "flex size-12 shrink-0 items-center justify-center rounded-full",
  {
    variants: {
      tone: {
        primary: "bg-sidebar-primary/10 text-sidebar-primary",
        "chart-2": "bg-chart-2/10 text-chart-2",
        "chart-3": "bg-chart-3/10 text-chart-3",
        "chart-4": "bg-chart-4/10 text-chart-4",
        success: "bg-success/10 text-success",
        warning: "bg-yellow-500/10 text-yellow-500",
        destructive: "bg-destructive/10 text-destructive",
        muted: "bg-muted-foreground/10 text-muted-foreground",
      },
    },
    defaultVariants: { tone: "primary" },
  },
);

export type StatTone = NonNullable<VariantProps<typeof iconVariants>["tone"]>;

export function StatCard({
  label,
  value,
  icon: Icon,
  tone,
  footer,
  action,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  icon: LucideIcon;
  tone?: StatTone;
  footer?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardDescription>{label}</CardDescription>
            <CardTitle className="text-2xl break-words tabular-nums">
              {value}
            </CardTitle>
            {footer && (
              <p className="mt-2 text-xs text-muted-foreground">{footer}</p>
            )}
          </div>
          <div className={iconVariants({ tone })}>
            <Icon className="size-6" />
          </div>
        </div>
        {action}
      </CardContent>
    </Card>
  );
}
