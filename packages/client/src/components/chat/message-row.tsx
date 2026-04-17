import { useState } from "react";
import type { CachedMessage } from "@createrington/shared/socket";
import { cn } from "@/lib/utils";
import { ChatMarkdown } from "./chat-markdown";
import { ImageFullscreen, MessageImageGrid } from "./message-images";
import { formatTime, transformWaypoints } from "./utils";

export function MessageRow({
  message,
  isFirst,
  tick,
  onImageLoad,
}: {
  message: CachedMessage;
  isFirst: boolean;
  tick: number;
  onImageLoad?: () => void;
}) {
  void tick;

  const [fullscreenImage, setFullscreenImage] = useState<{
    url: string;
    alt: string;
  } | null>(null);

  const imageAttachments = message.attachments.filter((a) =>
    a.contentType?.startsWith("image/"),
  );

  const isImageOnly =
    !message.content &&
    imageAttachments.length > 0 &&
    message.embeds.length === 0;
  const needsInlineTimestamp = !isFirst && isImageOnly;

  return (
    <>
      <div
        className={cn(
          "group relative pl-[3.25rem] transition-all duration-500",
          isFirst ? "pt-0" : "pt-0.5",
        )}
      >
        {!isFirst && !isImageOnly && (
          <span className="absolute right-0 top-0 opacity-0 text-[11px] text-muted-foreground/60 transition-opacity duration-150 group-hover:opacity-100">
            {formatTime(message.createdAt)}
            {message.editedAt && (
              <span className="ml-1 opacity-60">(edited)</span>
            )}
          </span>
        )}

        {message.content && (
          <ChatMarkdown variant="body">
            {transformWaypoints(message.content)}
          </ChatMarkdown>
        )}

        {imageAttachments.length > 0 && (
          <MessageImageGrid
            attachments={imageAttachments}
            onLoad={onImageLoad}
            onFullscreen={(url, alt) => setFullscreenImage({ url, alt })}
          />
        )}

        {needsInlineTimestamp && (
          <span className="mt-1 block text-[11px] text-muted-foreground/50">
            {formatTime(message.createdAt)}
            {message.editedAt && (
              <span className="ml-1 opacity-60">(edited)</span>
            )}
          </span>
        )}

        {message.embeds.map((embed, i) => {
          const isMedia =
            embed.type === "gifv" ||
            embed.type === "image" ||
            embed.type === "video";

          if (isMedia) {
            const mediaUrl =
              embed.video?.url || embed.image?.url || embed.thumbnail?.url;
            if (!mediaUrl) return null;

            const isVideo = !!embed.video?.url;
            return isVideo ? (
              <video
                key={i}
                src={mediaUrl}
                autoPlay
                loop
                muted
                playsInline
                className="mt-2 max-h-64 max-w-sm rounded"
                onLoadedData={onImageLoad}
              />
            ) : (
              <img
                key={i}
                src={mediaUrl}
                alt={embed.title || ""}
                className="mt-2 max-h-64 max-w-sm rounded object-contain"
                onLoad={onImageLoad}
              />
            );
          }

          return (
            <div
              key={i}
              className="mt-2 overflow-hidden rounded-lg border border-border bg-card/60 p-3"
              style={{
                borderLeftWidth: "3px",
                borderLeftColor:
                  embed.color !== undefined
                    ? `#${embed.color.toString(16).padStart(6, "0")}`
                    : "var(--primary)",
              }}
            >
              {embed.author && (
                <div className="mb-1 flex items-center gap-1.5">
                  {embed.author.iconUrl && (
                    <img
                      src={embed.author.iconUrl}
                      alt=""
                      className="size-5 rounded-full object-cover"
                    />
                  )}
                  <span className="text-sm font-semibold text-foreground">
                    {embed.author.url ? (
                      <a
                        href={embed.author.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        {embed.author.name}
                      </a>
                    ) : (
                      embed.author.name
                    )}
                  </span>
                </div>
              )}

              <div className="flex gap-4">
                <div className="min-w-0 flex-1">
                  {embed.title && (
                    <ChatMarkdown variant="embed-title">
                      {embed.title}
                    </ChatMarkdown>
                  )}
                  {embed.description && (
                    <div className={embed.title ? "mt-1" : ""}>
                      <ChatMarkdown variant="embed-body">
                        {embed.description}
                      </ChatMarkdown>
                    </div>
                  )}

                  {embed.fields && embed.fields.length > 0 && (
                    <div className="mt-2 grid grid-cols-3 gap-x-2 gap-y-1.5">
                      {embed.fields.map((field, j) => (
                        <div
                          key={j}
                          className={field.inline ? "" : "col-span-3"}
                        >
                          <div className="text-xs font-semibold text-foreground">
                            {field.name}
                          </div>
                          <ChatMarkdown variant="embed-body">
                            {field.value}
                          </ChatMarkdown>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {embed.thumbnail && (
                  <img
                    src={embed.thumbnail.url}
                    alt=""
                    className="size-16 shrink-0 rounded object-cover"
                  />
                )}
              </div>

              {embed.image && (
                <img
                  src={embed.image.url}
                  alt=""
                  className="mt-2 max-h-64 max-w-sm rounded object-contain"
                />
              )}

              {embed.footer && (
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
                  {embed.footer.iconUrl && (
                    <img
                      src={embed.footer.iconUrl}
                      alt=""
                      className="size-4 rounded-full"
                    />
                  )}
                  <span>{embed.footer.text}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {fullscreenImage && (
        <ImageFullscreen
          url={fullscreenImage.url}
          alt={fullscreenImage.alt}
          onClose={() => setFullscreenImage(null)}
        />
      )}
    </>
  );
}
