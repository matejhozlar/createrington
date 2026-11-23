import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { loaderName } from "@/features/workshop/format";
import { WORDMARK_IMAGE } from "@/features/workshop/constants";
import { WorkshopHero } from "./WorkshopHero";

const TITLE_CLASS =
  "text-4xl font-semibold text-shadow-[0_2px_8px_rgb(0_0_0/0.4)]";
const DESCRIPTION_CLASS =
  "mt-4 text-base text-zinc-200 text-shadow-[0_1px_4px_rgb(0_0_0/0.4)]";

export function WorkshopPageShell({
  heroClassName = "h-[340px]",
  backTo,
  backLabel,
  children,
}: {
  heroClassName?: string;
  backTo: string;
  backLabel: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden">
      <WorkshopHero className={heroClassName} />

      <div className="relative mx-auto max-w-6xl px-5 pt-8 pb-16 md:px-8">
        <Link
          to={backTo}
          className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-[15px]" />
          {backLabel}
        </Link>
        {children}
      </div>
    </div>
  );
}

export function WorkshopPageHeader({
  title,
  description,
  workshop,
  action,
}: {
  title: string;
  description: React.ReactNode;
  workshop?: { gameVersion: string; modLoaderType: number };
  action?: React.ReactNode;
}) {
  if (!workshop) {
    return (
      <header className="mt-5 max-w-[640px]">
        <h1 className={TITLE_CLASS}>{title}</h1>
        <p className={DESCRIPTION_CLASS}>{description}</p>
      </header>
    );
  }

  return (
    <header className="mt-5 flex flex-wrap items-center justify-between gap-6">
      <div className="max-w-[620px] min-w-0">
        <div className="flex flex-wrap items-center gap-3.5">
          <h1 className={TITLE_CLASS}>{title}</h1>
          <div className="flex gap-2">
            <Badge variant="outline">{workshop.gameVersion}</Badge>
            <Badge variant="outline">
              {loaderName(workshop.modLoaderType)}
            </Badge>
          </div>
        </div>
        {description && (
          <p className={cn(DESCRIPTION_CLASS, "max-w-2xl")}>{description}</p>
        )}
        {action && <div className="mt-6">{action}</div>}
      </div>
      <img
        src={WORDMARK_IMAGE}
        alt="Createrington"
        className="hidden w-[280px] drop-shadow-[0_6px_14px_rgb(0_0_0/0.55)] md:block"
      />
    </header>
  );
}
