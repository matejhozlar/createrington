import { cn } from "@/lib/utils";
import { modInitials } from "../format";

export function ProjectThumb({
  name,
  thumbnailUrl,
  className,
  title,
}: {
  name: string;
  thumbnailUrl: string | null | undefined;
  className: string;
  title?: string;
}) {
  if (thumbnailUrl) {
    return (
      <img
        src={thumbnailUrl}
        alt=""
        title={title}
        loading="lazy"
        className={cn("shrink-0 object-cover", className)}
      />
    );
  }
  return (
    <span
      title={title}
      className={cn(
        "flex shrink-0 items-center justify-center bg-secondary font-semibold text-muted-foreground",
        className,
      )}
    >
      {modInitials(name)}
    </span>
  );
}
