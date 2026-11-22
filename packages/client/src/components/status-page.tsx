import type { ComponentType, ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type StatusPageAction = {
  icon: ComponentType<{ className?: string }>;
  label: string;
  description: string;
  onClick: () => void;
};

type StatusPageTone = "muted" | "destructive";

const TONES: Record<StatusPageTone, { iconBox: string; accent: string }> = {
  muted: { iconBox: "bg-sidebar-accent", accent: "text-muted-foreground" },
  destructive: { iconBox: "bg-destructive/10", accent: "text-destructive" },
};

const ACTION_COLUMNS: Record<number, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
};

export const STATUS_CARD_CLASS =
  "border-border bg-card/60 backdrop-blur supports-[backdrop-filter]:bg-card/50";

interface StatusPageProps {
  icon: ComponentType<{ className?: string }>;
  tone?: StatusPageTone;
  title: string;
  badge: string;
  description: ReactNode;
  detail?: ReactNode;
  actions: StatusPageAction[];
  hero?: ReactNode;
}

export function StatusPage({
  icon: Icon,
  tone = "muted",
  title,
  badge,
  description,
  detail,
  actions,
  hero,
}: StatusPageProps) {
  const { iconBox, accent } = TONES[tone];

  const card = (
    <Card className={cn(STATUS_CARD_CLASS, !hero && "w-full max-w-xl")}>
      <CardHeader className="space-y-3">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex size-10 items-center justify-center rounded-lg",
              iconBox,
            )}
          >
            <Icon className={cn("size-5", accent)} />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold text-foreground">{title}</h1>
              <Badge variant="outline" className={accent}>
                {badge}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>

        {detail && (
          <div className="rounded-lg border border-border bg-sidebar-accent/40 px-3 py-2 text-sm text-muted-foreground font-mono break-all">
            {detail}
          </div>
        )}
      </CardHeader>

      <CardContent>
        <div className={cn("grid gap-3", ACTION_COLUMNS[actions.length])}>
          {actions.map(({ icon: ActionIcon, label, description, onClick }) => (
            <button
              key={label}
              type="button"
              onClick={onClick}
              className="group flex items-center gap-3 rounded-lg border border-border bg-background/40 p-3 text-left transition-colors hover:bg-sidebar-accent/30 cursor-pointer"
            >
              <div className="flex size-9 items-center justify-center rounded-md bg-sidebar-accent">
                <ActionIcon className="size-4 text-muted-foreground transition-colors group-hover:text-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div
      className={cn(
        "min-h-[calc(100vh-3.5rem)] md:min-h-screen flex items-center justify-center bg-background select-none",
        hero ? "p-4 sm:p-6" : "p-6",
      )}
    >
      {hero ? (
        <div className="w-full max-w-3xl space-y-4">
          {hero}
          {card}
        </div>
      ) : (
        card
      )}
    </div>
  );
}
