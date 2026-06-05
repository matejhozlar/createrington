import { ExternalLink } from "lucide-react";
import type {
  ComponentButton,
  ComponentNode,
  ComponentSection,
} from "@createrington/shared/api/embed";
import { useMentionResolver } from "@/features/admin/hooks/use-mention-resolver";
import { DiscordMarkdown } from "../components/DiscordMarkdown";

function numberToHex(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

type MentionResolver = ReturnType<typeof useMentionResolver>;

interface ComponentsPreviewProps {
  components: ComponentNode[];
}

export function ComponentsPreview({ components }: ComponentsPreviewProps) {
  const mentionResolver = useMentionResolver();

  return (
    <div
      style={{ backgroundColor: "#313338" }}
      className="rounded-lg p-4 font-sans text-sm"
    >
      <div className="flex items-start gap-3">
        <img
          src="/assets/logo/logo.png"
          alt="Createrington"
          className="size-10 shrink-0 rounded-full"
        />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-baseline gap-1.5">
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

          {components.length === 0 ? (
            <p className="text-xs italic" style={{ color: "#949BA4" }}>
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
        </div>
      </div>
    </div>
  );
}

interface NodePreviewProps {
  node: ComponentNode;
  mentionResolver: MentionResolver;
}

function NodePreview({ node, mentionResolver }: NodePreviewProps) {
  switch (node.type) {
    case "container":
      return (
        <div
          className="flex flex-col gap-2 overflow-hidden rounded p-3"
          style={{
            backgroundColor: "#2B2D31",
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
        <div className="text-sm" style={{ color: "#DBDEE1" }}>
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
            <div style={{ height: 1, backgroundColor: "#3F4147" }} />
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
                style={{ backgroundColor: "#1E1F22", color: "#949BA4" }}
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
            <ButtonPreview key={i} button={button} />
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
          <div key={i} className="text-sm" style={{ color: "#DBDEE1" }}>
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
            style={{ backgroundColor: "#1E1F22", color: "#949BA4" }}
          >
            thumb
          </div>
        )
      ) : (
        <ButtonPreview button={accessory} />
      )}
    </div>
  );
}

function ButtonPreview({ button }: { button: ComponentButton }) {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-2 rounded px-4 py-2 text-sm font-medium text-white"
      style={{ backgroundColor: "#4E5058" }}
    >
      {button.emoji && <span>{button.emoji}</span>}
      <span>{button.label || "Button"}</span>
      <ExternalLink className="size-3.5 opacity-60" />
    </span>
  );
}
