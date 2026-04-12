import type { EmbedData } from "@createrington/shared/api/embed";

interface EmbedActionPreviewProps {
  embed: Partial<EmbedData>;
}

function numberToHex(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

/**
 * Compact Discord-style preview rendered inside an admin-chat ActionCard.
 * Deliberately narrower and lighter than the full EmbedBuilder preview:
 * the drawer is ~400px wide and we only need enough fidelity that the
 * admin can decide whether to Apply without round-tripping to the builder.
 */
export function EmbedActionPreview({
  embed,
}: EmbedActionPreviewProps): React.JSX.Element {
  const stripe =
    typeof embed.color === "number" ? numberToHex(embed.color) : "#5865f2";
  const fields = Array.isArray(embed.fields) ? embed.fields : [];

  return (
    <div className="ac-embed-preview">
      <div className="ac-embed-stripe" style={{ background: stripe }} />
      <div className="ac-embed-body">
        {embed.author && <div className="ac-embed-author">{embed.author}</div>}
        {embed.title && (
          <div className="ac-embed-title">{String(embed.title)}</div>
        )}
        <div className="ac-embed-main">
          <div className="ac-embed-text">
            {embed.description && (
              <div className="ac-embed-desc">{String(embed.description)}</div>
            )}
            {fields.length > 0 && (
              <div className="ac-embed-fields">
                {fields.slice(0, 6).map((f, i) => (
                  <div
                    key={i}
                    className={`ac-embed-field${f.inline ? " ac-embed-field-inline" : ""}`}
                  >
                    <div className="ac-embed-field-name">{f.name}</div>
                    <div className="ac-embed-field-value">{f.value}</div>
                  </div>
                ))}
                {fields.length > 6 && (
                  <div className="ac-embed-fields-more">
                    +{fields.length - 6} more
                  </div>
                )}
              </div>
            )}
          </div>
          {embed.thumbnailUrl && (
            <img
              className="ac-embed-thumb"
              src={embed.thumbnailUrl}
              alt=""
              loading="lazy"
            />
          )}
        </div>
        {embed.imageUrl && (
          <img
            className="ac-embed-image"
            src={embed.imageUrl}
            alt=""
            loading="lazy"
          />
        )}
        {embed.footer && (
          <div className="ac-embed-footer">{String(embed.footer)}</div>
        )}
      </div>
    </div>
  );
}
