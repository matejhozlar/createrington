import { PlayerLabel } from "@/components/player-label";
import { aspectRatio, altText, creditName, type GalleryItem } from "../format";

interface GalleryTileProps {
  item: GalleryItem;
  onOpen: () => void;
}

export function GalleryTile({ item, onOpen }: GalleryTileProps) {
  return (
    <figure className="group mb-4 break-inside-avoid overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/40">
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
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
      </button>

      <figcaption className="space-y-2 p-3">
        {item.caption ? (
          <p className="line-clamp-2 text-sm text-foreground">{item.caption}</p>
        ) : null}
        <div className="flex w-fit items-center text-sm text-muted-foreground">
          <PlayerLabel
            uuid={item.author.minecraftUuid}
            name={creditName(item.author)}
            size={20}
          />
        </div>
      </figcaption>
    </figure>
  );
}
