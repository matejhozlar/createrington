import { cn } from "@/lib/utils";
import { modInitials } from "../format";

export function ProjectThumb({
  name,
  thumbnailUrl,
  className,
}: {
  name: string;
  thumbnailUrl: string | null | undefined;
  className: string;
}) {
  if (thumbnailUrl) {
    return (
      <img
        src={thumbnailUrl}
        alt=""
        loading="lazy"
        className={cn("shrink-0 object-cover", className)}
      />
    );
  }
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center bg-secondary font-semibold text-muted-foreground",
        className,
      )}
    >
      {modInitials(name)}
    </span>
  );
}
