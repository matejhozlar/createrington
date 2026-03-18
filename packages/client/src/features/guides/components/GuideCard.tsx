import { Link } from "react-router-dom";
import { Clock } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Guide } from "../data";

const DIFFICULTY_STYLES = {
  beginner: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  intermediate: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  advanced: "bg-red-500/10 text-red-400 border-red-500/20",
} as const;

type GuideCardProps = {
  guide: Guide;
};

export function GuideCard({ guide }: GuideCardProps) {
  const Icon = guide.icon;

  return (
    <Link to={`/guides/${guide.slug}`}>
      <Card className="h-full transition-colors hover:border-primary/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-lg bg-primary/10">
              <Icon className="size-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle>{guide.title}</CardTitle>
            </div>
          </div>
          <CardDescription>{guide.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Badge
              className={cn(
                "border text-xs capitalize",
                DIFFICULTY_STYLES[guide.difficulty],
              )}
            >
              {guide.difficulty}
            </Badge>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="size-3" />
              ~{guide.estimatedMinutes} min
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
