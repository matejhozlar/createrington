import { Link } from "react-router-dom";
import { Clock } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import type { Guide } from "../data";

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
            <div className="flex items-center justify-center size-10 rounded-full bg-primary/10">
              <Icon className="size-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle>{guide.title}</CardTitle>
            </div>
          </div>
          <CardDescription>{guide.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3" />
            ~{guide.estimatedMinutes} min
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}
