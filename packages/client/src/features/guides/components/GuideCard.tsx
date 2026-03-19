import { Link } from "react-router-dom";
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
    <Link to={`/guides/${guide.slug}`}>
      <Card className="h-full overflow-hidden border-border pt-0">
        <div className="p-2">
          <div className="relative aspect-video">
            <div
              className="absolute inset-0 bg-cover bg-center rounded-lg"
              style={{ backgroundImage: `url('${guide.image}')` }}
            />
            <div className="absolute inset-0 bg-black/70 rounded-lg" />
            {guide.imageIcon && (
              <div className="absolute top-2 left-2">
                <img
                  src={guide.imageIcon}
                  alt={guide.title}
                  className="max-w-24 max-h-24 shadow-md"
                />
              </div>
            )}
          </div>
        </div>

        <CardHeader>
          <CardTitle className="text-xl">{guide.title}</CardTitle>

          <CardDescription className="text-base">
            {guide.description}
          </CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}
