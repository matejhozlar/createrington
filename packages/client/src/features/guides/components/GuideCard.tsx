import { Link } from "react-router";
import { ArrowRight, Clock } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import type { Guide } from "../data";

type GuideCardProps = {
  guide: Guide;
};

export function GuideCard({ guide }: GuideCardProps) {
  return (
    <Link to={`/guides/${guide.slug}`} className="group block">
      <Card className="h-full overflow-hidden border-border pt-0 transition-all duration-300 group-hover:border-primary/40 group-hover:-translate-y-0.5 group-hover:shadow-lg group-hover:shadow-primary/5">
        <div className="p-2">
          <div className="relative aspect-video overflow-hidden rounded-lg">
            <div
              className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
              style={{ backgroundImage: `url('${guide.image}')` }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/60 to-black/40" />
            {guide.imageIcon && (
              <div className="absolute top-3 left-3">
                {typeof guide.imageIcon === "string" ? (
                  <img
                    src={guide.imageIcon}
                    alt=""
                    width={96}
                    height={96}
                    className="w-20 h-20 object-contain drop-shadow-lg"
                  />
                ) : (
                  <guide.imageIcon
                    className="size-14 text-white drop-shadow-lg"
                    strokeWidth={1.5}
                  />
                )}
              </div>
            )}
            <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-black/60 backdrop-blur-sm px-2.5 py-1 text-xs text-white/90">
              <Clock className="size-3" />
              <span>{guide.estimatedMinutes} min</span>
            </div>
          </div>
        </div>

        <CardHeader>
          <CardTitle className="text-xl flex items-start justify-between gap-2">
            <span>{guide.title}</span>
            <ArrowRight className="size-5 shrink-0 text-muted-foreground/50 mt-1 transition-all duration-300 group-hover:text-primary group-hover:translate-x-0.5" />
          </CardTitle>

          <CardDescription className="text-base">
            {guide.description}
          </CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}
