import type { ReactNode } from "react";
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function PackCard({
  title,
  count,
  description,
  action,
  children,
}: {
  title: string;
  count: number;
  description: string;
  action: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="gap-0">
      <CardHeader className="border-b">
        <CardTitle>
          {title} ({count.toLocaleString()})
        </CardTitle>
        <CardDescription className="max-sm:col-start-1">
          {description}
        </CardDescription>
        <CardAction className="max-sm:col-span-full max-sm:row-start-3 max-sm:mt-2 max-sm:justify-self-stretch">
          {action}
        </CardAction>
      </CardHeader>
      {children}
    </Card>
  );
}
