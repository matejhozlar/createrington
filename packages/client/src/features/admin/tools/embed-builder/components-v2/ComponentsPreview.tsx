import type {
  AnyComponentNode,
  ComponentNode,
  ComponentSection,
} from "@createrington/shared/api/embed";
import { useMentionResolver } from "@/features/admin/hooks/use-mention-resolver";
import { numberToHex } from "@/lib/utils";
import {
  DiscordMarkdown,
  type MentionResolver,
} from "@/features/admin/components/discord/DiscordMarkdown";
import { DiscordMessageFrame } from "@/features/admin/components/discord/DiscordMessageFrame";
import { DiscordButton } from "@/features/admin/components/discord/DiscordButton";
import { DISCORD_COLORS } from "@/features/admin/components/discord/colors";

const PLACEHOLDER_STYLE = {
  backgroundColor: DISCORD_COLORS.inset,
  color: DISCORD_COLORS.muted,
};

interface ComponentsPreviewProps {
  components: ComponentNode[];
}

export function ComponentsPreview({ components }: ComponentsPreviewProps) {
  const mentionResolver = useMentionResolver();

  return (
    <DiscordMessageFrame>
      {components.length === 0 ? (
        <p className="text-xs italic" style={{ color: DISCORD_COLORS.muted }}>
          Add components to preview the message
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {components.map((node, i) => (
            <NodePreview
              key={i}
              node={node}
              mentionResolver={mentionResolver}
            />
          ))}
        </div>
      )}
    </DiscordMessageFrame>
  );
}

interface NodePreviewProps {
  node: AnyComponentNode;
  mentionResolver: MentionResolver;
}

function NodePreview({ node, mentionResolver }: NodePreviewProps) {
  switch (node.type) {
    case "container":
      return (
        <div
          className="flex flex-col gap-2 overflow-hidden rounded p-3"
          style={{
            backgroundColor: DISCORD_COLORS.embed,
            borderLeft:
              node.accentColor !== undefined
                ? `4px solid ${numberToHex(node.accentColor)}`
                : undefined,
          }}
        >
          {node.components.map((child, i) => (
            <NodePreview
              key={i}
              node={child}
              mentionResolver={mentionResolver}
            />
          ))}
        </div>
      );
    case "text":
      return (
        <div className="text-sm" style={{ color: DISCORD_COLORS.text }}>
          <DiscordMarkdown
            mentionResolver={mentionResolver}
            text={node.content || "Text display"}
          />
        </div>
      );
    case "separator":
      return (
        <div style={{ padding: node.spacing === 2 ? "8px 0" : "2px 0" }}>
          {node.divider && (
            <div
              style={{ height: 1, backgroundColor: DISCORD_COLORS.divider }}
            />
          )}
        </div>
      );
    case "media_gallery":
      return (
        <div className="grid grid-cols-2 gap-1.5">
          {node.items.map((item, i) =>
            item.url ? (
              <img
                key={i}
                src={item.url}
                alt={item.description ?? ""}
                className="w-full rounded object-cover"
                style={{ maxHeight: 160 }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <div
                key={i}
                className="flex h-20 items-center justify-center rounded text-xs italic"
                style={PLACEHOLDER_STYLE}
              >
                image
              </div>
            ),
          )}
        </div>
      );
    case "section":
      return <SectionPreview node={node} mentionResolver={mentionResolver} />;
    case "action_row":
      return (
        <div className="flex flex-wrap gap-2">
          {node.components.map((button, i) => (
            <DiscordButton
              key={i}
              label={button.label || "Button"}
              emoji={button.emoji}
            />
          ))}
        </div>
      );
  }
}

function SectionPreview({
  node,
  mentionResolver,
}: {
  node: ComponentSection;
  mentionResolver: MentionResolver;
}) {
  const { accessory } = node;
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {node.components.map((text, i) => (
          <div
            key={i}
            className="text-sm"
            style={{ color: DISCORD_COLORS.text }}
          >
            <DiscordMarkdown
              mentionResolver={mentionResolver}
              text={text.content || "Text display"}
            />
          </div>
        ))}
      </div>
      {accessory.type === "thumbnail" ? (
        accessory.url ? (
          <img
            src={accessory.url}
            alt={accessory.description ?? ""}
            className="size-16 shrink-0 rounded object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div
            className="flex size-16 shrink-0 items-center justify-center rounded text-[10px] italic"
            style={PLACEHOLDER_STYLE}
          >
            thumb
          </div>
        )
      ) : (
        <DiscordButton
          label={accessory.label || "Button"}
          emoji={accessory.emoji}
        />
      )}
    </div>
  );
}
