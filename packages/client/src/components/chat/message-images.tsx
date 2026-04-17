import { Maximize2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function ImageTile({
  url,
  alt,
  onFullscreen,
  onLoad,
  className,
}: {
  url: string;
  alt: string;
  onFullscreen: () => void;
  onLoad?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-lg border border-border bg-sidebar-accent",
        className,
      )}
    >
      <img
        src={url}
        alt={alt}
        onLoad={onLoad}
        className="w-full h-full cursor-pointer object-cover transition-transform duration-200 group-hover:scale-105"
        onClick={onFullscreen}
      />
      <button
        onClick={onFullscreen}
        className="absolute right-1.5 top-1.5 rounded-md bg-background/70 p-1 opacity-0 backdrop-blur-sm transition-opacity duration-150 group-hover:opacity-100"
      >
        <Maximize2 className="size-3.5 text-foreground" />
      </button>
    </div>
  );
}

export function MessageImageGrid({
  attachments,
  onLoad,
  onFullscreen,
}: {
  attachments: { url: string; filename: string }[];
  onLoad?: () => void;
  onFullscreen: (url: string, alt: string) => void;
}) {
  const count = attachments.length;

  if (count === 1) {
    const img = attachments[0];
    return (
      <div className="mt-2 max-w-sm">
        <ImageTile
          url={img.url}
          alt={img.filename}
          onLoad={onLoad}
          onFullscreen={() => onFullscreen(img.url, img.filename)}
          className="max-h-64 w-full"
        />
      </div>
    );
  }

  if (count === 2) {
    return (
      <div className="mt-2 grid max-w-sm grid-cols-2 gap-1.5">
        {attachments.map((img, i) => (
          <ImageTile
            key={i}
            url={img.url}
            alt={img.filename}
            onLoad={onLoad}
            onFullscreen={() => onFullscreen(img.url, img.filename)}
            className="h-36"
          />
        ))}
      </div>
    );
  }

  const [first, ...rest] = attachments;
  return (
    <div
      className="mt-2 grid max-w-sm grid-cols-2 grid-rows-2 gap-1.5"
      style={{ height: "18rem" }}
    >
      <ImageTile
        url={first.url}
        alt={first.filename}
        onLoad={onLoad}
        onFullscreen={() => onFullscreen(first.url, first.filename)}
        className="row-span-2"
      />
      {rest.slice(0, 2).map((img, i) => {
        const isLastVisible = i === 1 && rest.length > 2;
        const overflow = rest.length - 2;
        return (
          <div key={i} className="relative">
            <ImageTile
              url={img.url}
              alt={img.filename}
              onLoad={onLoad}
              onFullscreen={() => onFullscreen(img.url, img.filename)}
              className="h-full"
            />
            {isLastVisible && (
              <div
                className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/60 cursor-pointer"
                onClick={() => onFullscreen(img.url, img.filename)}
              >
                <span className="text-lg font-bold text-white">
                  +{overflow}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ImageFullscreen({
  url,
  alt,
  onClose,
}: {
  url: string;
  alt: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full bg-sidebar-accent p-2 backdrop-blur-sm transition-colors hover:bg-sidebar-accent/80"
      >
        <X className="size-6 text-foreground cursor-pointer" />
      </button>
      <img
        src={url}
        alt={alt}
        className="max-h-full max-w-full rounded-lg object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
