import type { CSSProperties, ReactNode } from "react";
import {
  EMBED_MAX_BUTTONS,
  EMBED_MAX_FIELDS,
  type EmbedData,
} from "@createrington/shared/api/embed";
import { useMentionResolver } from "@/features/admin/hooks/use-mention-resolver";
import { cn, numberToHex } from "@/lib/utils";
import { DiscordMarkdown } from "@/features/admin/components/discord/DiscordMarkdown";
import { DiscordMessageFrame } from "@/features/admin/components/discord/DiscordMessageFrame";
import { DiscordButton } from "@/features/admin/components/discord/DiscordButton";
import { DISCORD_COLORS } from "@/features/admin/components/discord/colors";
import type { FocusTarget } from "@/features/admin/tools/embed-builder/focus";

interface EmbedPreviewProps {
  data: EmbedData;
  editable?: boolean;
  onEdit?: (target: FocusTarget) => void;
}

export function EmbedPreview({
  data,
  editable = false,
  onEdit,
}: EmbedPreviewProps) {
  const mentionResolver = useMentionResolver();

  const hasEmbed =
    data.title ||
    data.description ||
    data.fields.length > 0 ||
    data.imageUrl ||
    data.author ||
    data.footer ||
    data.thumbnailUrl ||
    data.timestamp;
  const borderColor =
    data.color !== undefined ? numberToHex(data.color) : DISCORD_COLORS.blurple;

  const linkButtons = data.buttons;
  const actionButtons = data.actionButtons;
  const hasButtons = linkButtons.length + actionButtons.length > 0;
  const canAddButton =
    linkButtons.length + actionButtons.length < EMBED_MAX_BUTTONS;

  return (
    <DiscordMessageFrame>
      {data.content ? (
        <Hover
          editable={editable}
          onClick={() => onEdit?.("content")}
          label="Message"
          className="mb-1"
        >
          <div className="text-sm" style={{ color: DISCORD_COLORS.text }}>
            <DiscordMarkdown
              mentionResolver={mentionResolver}
              text={data.content}
            />
          </div>
        </Hover>
      ) : editable ? (
        <Empty
          label="Add message"
          onClick={() => onEdit?.("content")}
          className="mb-1"
        >
          + message text above embed
        </Empty>
      ) : null}

      {(hasEmbed || (editable && !hasEmbed)) && (
        <div
          className="grid overflow-hidden rounded"
          style={{
            backgroundColor: DISCORD_COLORS.embed,
            borderLeft: `4px solid ${borderColor}`,
            gridTemplateColumns: data.thumbnailUrl ? "1fr auto" : "1fr",
          }}
        >
          <div className="flex min-w-0 flex-col gap-2 p-4">
            {data.author ? (
              <Hover
                editable={editable}
                onClick={() => onEdit?.("author")}
                label="Author"
              >
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
                  <span className="text-xs font-semibold text-white">
                    {data.author}
                  </span>
                </div>
              </Hover>
            ) : editable ? (
              <Empty label="Add author" onClick={() => onEdit?.("author")}>
                + author
              </Empty>
            ) : null}

            {data.title ? (
              <Hover
                editable={editable}
                onClick={() => onEdit?.("title")}
                label="Title"
              >
                <span
                  className="font-semibold"
                  style={{
                    color: data.url
                      ? DISCORD_COLORS.link
                      : DISCORD_COLORS.heading,
                  }}
                >
                  {data.title}
                </span>
              </Hover>
            ) : editable ? (
              <Empty label="Add title" onClick={() => onEdit?.("title")}>
                + title
              </Empty>
            ) : null}

            {data.description ? (
              <Hover
                editable={editable}
                onClick={() => onEdit?.("description")}
                label="Description"
              >
                <div className="text-sm" style={{ color: DISCORD_COLORS.text }}>
                  <DiscordMarkdown
                    mentionResolver={mentionResolver}
                    text={data.description}
                  />
                </div>
              </Hover>
            ) : editable ? (
              <Empty
                label="Add description"
                onClick={() => onEdit?.("description")}
              >
                + description
              </Empty>
            ) : null}

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
                  <Hover
                    key={i}
                    editable={editable}
                    onClick={() => onEdit?.(`field:${i}`)}
                    label={`Field ${i + 1}`}
                    style={{
                      gridColumn: field.inline ? undefined : "1 / -1",
                    }}
                  >
                    <div>
                      <div className="text-xs font-semibold text-white">
                        <DiscordMarkdown
                          mentionResolver={mentionResolver}
                          text={field.name || "Field name"}
                        />
                      </div>
                      <div
                        className="text-sm"
                        style={{ color: DISCORD_COLORS.text }}
                      >
                        <DiscordMarkdown
                          mentionResolver={mentionResolver}
                          text={field.value || "Field value"}
                        />
                      </div>
                    </div>
                  </Hover>
                ))}
              </div>
            )}

            {editable && data.fields.length < EMBED_MAX_FIELDS && (
              <Empty
                label="Add field"
                onClick={() => onEdit?.("fields:add")}
                subtle
              >
                + add field
              </Empty>
            )}

            {data.imageUrl ? (
              <Hover
                editable={editable}
                onClick={() => onEdit?.("imageUrl")}
                label="Image"
              >
                <img
                  src={data.imageUrl}
                  alt=""
                  className="max-w-full rounded"
                  style={{ maxHeight: 300 }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </Hover>
            ) : editable ? (
              <Empty
                label="Add image"
                onClick={() => onEdit?.("imageUrl")}
                subtle
              >
                + image
              </Empty>
            ) : null}

            {data.footer || data.timestamp ? (
              <Hover
                editable={editable}
                onClick={() => onEdit?.("footer")}
                label="Footer"
              >
                <div
                  className="flex items-center gap-1.5 text-xs"
                  style={{ color: DISCORD_COLORS.muted }}
                >
                  {data.footer && <span>{data.footer}</span>}
                  {data.footer && data.timestamp && <span>•</span>}
                  {data.timestamp && (
                    <span>{new Date().toLocaleDateString()}</span>
                  )}
                </div>
              </Hover>
            ) : editable ? (
              <Empty
                label="Add footer"
                onClick={() => onEdit?.("footer")}
                subtle
              >
                + footer
              </Empty>
            ) : null}
          </div>

          {data.thumbnailUrl ? (
            <div className="p-4 pl-0">
              <Hover
                editable={editable}
                onClick={() => onEdit?.("thumbnailUrl")}
                label="Thumbnail"
              >
                <img
                  src={data.thumbnailUrl}
                  alt=""
                  className="size-20 rounded object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </Hover>
            </div>
          ) : null}
        </div>
      )}

      {(hasButtons || (editable && canAddButton)) && (
        <div className="mt-2 flex flex-wrap gap-2">
          {linkButtons.map((b, i) => (
            <Hover
              key={`l${i}`}
              editable={editable}
              onClick={() => onEdit?.(`button:link:${i}`)}
              label={`Link ${i + 1}`}
              inline
            >
              <DiscordButton label={b.label || "Button"} emoji={b.emoji} />
            </Hover>
          ))}
          {actionButtons.map((b, i) => (
            <Hover
              key={`a${i}`}
              editable={editable}
              onClick={() => onEdit?.(`button:action:${i}`)}
              label={`Action ${i + 1}`}
              inline
            >
              <DiscordButton
                label={b.label || "Action"}
                emoji={b.emoji}
                link={false}
              />
            </Hover>
          ))}
          {editable && canAddButton && (
            <Empty
              label="Add button"
              onClick={() => onEdit?.("buttons:add")}
              inline
            >
              + add button
            </Empty>
          )}
        </div>
      )}
    </DiscordMessageFrame>
  );
}

interface HoverProps {
  editable: boolean;
  onClick?: () => void;
  label: string;
  className?: string;
  style?: CSSProperties;
  inline?: boolean;
  children: ReactNode;
}

function Hover({
  editable,
  onClick,
  label,
  className,
  style,
  inline,
  children,
}: HoverProps) {
  if (!editable) {
    return (
      <div className={cn(inline && "inline-block", className)} style={style}>
        {children}
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={cn(
        "cursor-pointer rounded",
        inline ? "inline-block" : "block",
        className,
      )}
      style={style}
    >
      {children}
    </div>
  );
}

interface EmptyProps {
  label: string;
  onClick: () => void;
  className?: string;
  subtle?: boolean;
  inline?: boolean;
  children: ReactNode;
}

function Empty({
  label,
  onClick,
  className,
  subtle,
  inline,
  children,
}: EmptyProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      title={label}
      className={cn(
        "group/empty relative cursor-pointer rounded border border-dashed px-2 py-1 text-xs italic transition-opacity pointer-coarse:py-2",
        inline ? "inline-block" : "block",
        subtle ? "opacity-40" : "opacity-55",
        "hover:opacity-100",
        className,
      )}
      style={{
        borderColor: DISCORD_COLORS.secondaryButton,
        color: DISCORD_COLORS.muted,
      }}
    >
      {children}
    </div>
  );
}
