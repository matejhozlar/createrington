import { PlayerLabel } from "@/components/player-label";
import { formatRelativeDate } from "@/lib/format";
import { aspectRatio, altText, creditName, type GalleryItem } from "../format";

interface GalleryTileProps {
  item: GalleryItem;
  onOpen: () => void;
}

export function GalleryTile({ item, onOpen }: GalleryTileProps) {
  return (
    <figure className="mb-4 break-inside-avoid overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/40">
      <button
        type="button"
        onClick={onOpen}
        style={{ aspectRatio: aspectRatio(item) }}
        className="block w-full overflow-hidden bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <img
          src={item.images.thumb}
          alt={altText(item)}
          width={item.width ?? undefined}
          height={item.height ?? undefined}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      </button>

      <figcaption className="space-y-2 p-3">
        {item.caption ? (
          <p className="line-clamp-2 text-sm text-foreground">{item.caption}</p>
        ) : null}
        <div className="flex min-w-0 items-center gap-x-3 text-sm text-muted-foreground">
          <PlayerLabel
            uuid={item.author.minecraftUuid}
            name={creditName(item.author)}
            size={20}
          />
          {item.publishedAt ? (
            <span className="ml-auto shrink-0">
              {formatRelativeDate(item.publishedAt)}
            </span>
          ) : null}
        </div>
      </figcaption>
    </figure>
  );
}
