import type {
  ComponentButton,
  ComponentNode,
  ComponentSection,
} from "@createrington/shared/api/embed";

interface ComponentsActionPreviewProps {
  components: ComponentNode[];
}

function numberToHex(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

/**
 * Compact Components V2 preview rendered inside an admin-chat ActionCard.
 * Mirrors EmbedActionPreview's lightweight fidelity: enough for the admin
 * to decide whether to Apply, not a pixel-perfect render of the builder.
 */
export function ComponentsActionPreview({
  components,
}: ComponentsActionPreviewProps): React.JSX.Element {
  return (
    <div className="flex max-w-full flex-col gap-1.5 overflow-hidden rounded border border-border bg-muted px-2.5 py-2">
      {components.length === 0 ? (
        <span className="text-[0.6875rem] italic text-muted-foreground">
          No components
        </span>
      ) : (
        components.map((node, i) => <NodePreview key={i} node={node} />)
      )}
    </div>
  );
}

function NodePreview({ node }: { node: ComponentNode }): React.JSX.Element {
  switch (node.type) {
    case "container":
      return (
        <div
          className="flex flex-col gap-1 rounded border-l-2 pl-2"
          style={{
            borderColor:
              node.accentColor !== undefined
                ? numberToHex(node.accentColor)
                : "transparent",
          }}
        >
          {node.components.map((child, i) => (
            <NodePreview key={i} node={child} />
          ))}
        </div>
      );
    case "text":
      return (
        <div className="line-clamp-3 text-xs break-words whitespace-pre-wrap text-muted-foreground">
          {node.content || "Text"}
        </div>
      );
    case "separator":
      return <div className="my-0.5 h-px w-full bg-border" aria-hidden />;
    case "media_gallery":
      return (
        <div className="text-[0.6875rem] text-muted-foreground">
          🖼 {node.items.length} image{node.items.length === 1 ? "" : "s"}
        </div>
      );
    case "section":
      return <SectionPreview node={node} />;
    case "action_row":
      return (
        <div className="flex flex-wrap gap-1">
          {node.components.map((button, i) => (
            <ButtonChip key={i} button={button} />
          ))}
        </div>
      );
  }
}

function SectionPreview({
  node,
}: {
  node: ComponentSection;
}): React.JSX.Element {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {node.components.map((text, i) => (
          <div
            key={i}
            className="line-clamp-2 text-xs break-words text-muted-foreground"
          >
            {text.content || "Text"}
          </div>
        ))}
      </div>
      {node.accessory.type === "thumbnail" ? (
        <span className="shrink-0 text-[0.6875rem] text-muted-foreground">
          🖼
        </span>
      ) : (
        <ButtonChip button={node.accessory} />
      )}
    </div>
  );
}

function ButtonChip({
  button,
}: {
  button: ComponentButton;
}): React.JSX.Element {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded bg-background px-1.5 py-0.5 text-[0.6875rem] text-foreground">
      {button.emoji && <span>{button.emoji}</span>}
      {button.label || "Button"}
    </span>
  );
}
