import { ExternalLink } from "lucide-react";
import type { EmbedData } from "@createrington/shared/api/embed";
import { useMentionResolver } from "@/features/admin/hooks/use-mention-resolver";
import { DiscordMarkdown } from "./DiscordMarkdown";

function numberToHex(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

interface EmbedPreviewProps {
  data: EmbedData;
}

export function EmbedPreview({ data }: EmbedPreviewProps) {
  const mentionResolver = useMentionResolver();

  const hasEmbed =
    data.title || data.description || data.fields.length > 0 || data.imageUrl;
  const borderColor =
    data.color !== undefined ? numberToHex(data.color) : "#202225";

  if (!hasEmbed && !data.author && !data.footer && !data.content) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-dashed border-border p-12 text-sm text-muted-foreground">
        Fill in the form to see a live preview
      </div>
    );
  }

  const showEmbed = hasEmbed || data.author || data.footer;

  return (
    <div
      style={{ backgroundColor: "#313338" }}
      className="rounded-lg p-4 font-sans text-sm"
    >
      {/* Bot header */}
      <div className="mb-1 flex items-center gap-2">
        <img
          src="/assets/logo/logo.png"
          alt="Createrington"
          className="size-10 shrink-0 rounded-full"
        />
        <div className="flex items-baseline gap-1.5">
          <span className="font-medium text-white">Createrington</span>
          <span
            className="rounded px-1 py-0.5 text-[10px] font-semibold text-white"
            style={{ backgroundColor: "#5865F2" }}
          >
            APP
          </span>
          <span className="text-xs" style={{ color: "#949BA4" }}>
            Today at{" "}
            {new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      </div>

      {/* Message body (content + embed) */}
      <div className="ml-12 max-w-[520px]">
        {data.content && (
          <div
            className={showEmbed ? "mb-1 text-sm" : "text-sm"}
            style={{ color: "#DBDEE1" }}
          >
            <DiscordMarkdown
              mentionResolver={mentionResolver}
              text={data.content}
            />
          </div>
        )}
        {showEmbed && (
          <div
            className="grid overflow-hidden rounded"
            style={{
              backgroundColor: "#2B2D31",
              borderLeft: `4px solid ${borderColor}`,
              gridTemplateColumns: data.thumbnailUrl ? "1fr auto" : "1fr",
            }}
          >
            <div className="flex flex-col gap-2 p-4">
              {/* Author */}
              {data.author && (
                <div className="flex items-center gap-2">
                  {data.authorIconUrl && (
                    <img
                      src={data.authorIconUrl}
                      alt=""
                      className="size-6 rounded-full"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  )}
                  {data.authorUrl ? (
                    <a
                      href={data.authorUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-white hover:underline"
                    >
                      {data.author}
                    </a>
                  ) : (
                    <span className="text-xs font-semibold text-white">
                      {data.author}
                    </span>
                  )}
                </div>
              )}

              {/* Title */}
              {data.title && (
                <div>
                  {data.url ? (
                    <a
                      href={data.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold hover:underline"
                      style={{ color: "#00AFF4" }}
                    >
                      {data.title}
                    </a>
                  ) : (
                    <span className="font-semibold text-white">
                      {data.title}
                    </span>
                  )}
                </div>
              )}

              {/* Description */}
              {data.description && (
                <div className="text-sm" style={{ color: "#DBDEE1" }}>
                  <DiscordMarkdown
                    mentionResolver={mentionResolver}
                    text={data.description}
                  />
                </div>
              )}

              {/* Fields */}
              {data.fields.length > 0 && (
                <div
                  className="grid gap-2"
                  style={{
                    gridTemplateColumns: data.fields.some((f) => f.inline)
                      ? "repeat(3, 1fr)"
                      : "1fr",
                  }}
                >
                  {data.fields.map((field, i) => (
                    <div
                      key={i}
                      style={{
                        gridColumn: field.inline ? undefined : "1 / -1",
                      }}
                    >
                      <div className="text-xs font-semibold text-white">
                        <DiscordMarkdown
                          mentionResolver={mentionResolver}
                          text={field.name}
                        />
                      </div>
                      <div className="text-sm" style={{ color: "#DBDEE1" }}>
                        <DiscordMarkdown
                          mentionResolver={mentionResolver}
                          text={field.value}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Image */}
              {data.imageUrl && (
                <img
                  src={data.imageUrl}
                  alt=""
                  className="mt-1 max-w-full rounded"
                  style={{ maxHeight: 300 }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              )}

              {/* Footer */}
              {(data.footer || data.timestamp) && (
                <div
                  className="flex items-center gap-1.5 text-xs"
                  style={{ color: "#949BA4" }}
                >
                  {data.footer && <span>{data.footer}</span>}
                  {data.footer && data.timestamp && <span>•</span>}
                  {data.timestamp && (
                    <span>{new Date().toLocaleDateString()}</span>
                  )}
                </div>
              )}
            </div>

            {/* Thumbnail */}
            {data.thumbnailUrl && (
              <div className="p-4 pl-0">
                <img
                  src={data.thumbnailUrl}
                  alt=""
                  className="size-20 rounded object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Buttons */}
        {((data.buttons && data.buttons.length > 0) ||
          (data.actionButtons && data.actionButtons.length > 0)) && (
          <div className="mt-1 flex flex-wrap gap-2">
            {data.buttons?.map((button, i) => (
              <a
                key={`link-${i}`}
                href={button.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded px-4 py-2 text-sm font-medium text-white transition-colors hover:brightness-125"
                style={{ backgroundColor: "#4E5058" }}
              >
                {button.emoji && <span>{button.emoji}</span>}
                {button.label}
                <ExternalLink className="size-3.5 opacity-60" />
              </a>
            ))}
            {data.actionButtons?.map((button, i) => (
              <span
                key={`action-${i}`}
                className="inline-flex cursor-pointer items-center gap-2 rounded px-4 py-2 text-sm font-medium text-white transition-colors hover:brightness-125"
                style={{ backgroundColor: "#5865F2" }}
              >
                {button.emoji && <span>{button.emoji}</span>}
                {button.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
