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
    <div className="flex max-w-full overflow-hidden rounded border border-border bg-muted">
      <div
        className="w-[3px] shrink-0"
        style={{ background: stripe }}
        aria-hidden
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1 px-2.5 py-2">
        {embed.author && (
          <div className="text-[0.6875rem] font-medium text-muted-foreground">
            {embed.author}
          </div>
        )}
        {embed.title && (
          <div className="break-words text-[0.8125rem] leading-tight font-semibold text-foreground">
            {String(embed.title)}
          </div>
        )}
        <div className="flex items-start gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {embed.description && (
              <div className="text-xs leading-snug break-words whitespace-pre-wrap text-muted-foreground">
                {String(embed.description)}
              </div>
            )}
            {fields.length > 0 && (
              <div className="mt-1 grid grid-cols-1 gap-1">
                {fields.slice(0, 6).map((f, i) => (
                  <div key={i} className="flex flex-col gap-px">
                    <div className="text-[0.6875rem] font-semibold text-foreground">
                      {f.name}
                    </div>
                    <div className="text-[0.6875rem] break-words whitespace-pre-wrap text-muted-foreground">
                      {f.value}
                    </div>
                  </div>
                ))}
                {fields.length > 6 && (
                  <div className="text-[0.6875rem] italic text-muted-foreground">
                    +{fields.length - 6} more
                  </div>
                )}
              </div>
            )}
          </div>
          {embed.thumbnailUrl && (
            <img
              className="size-12 shrink-0 rounded object-cover"
              src={embed.thumbnailUrl}
              alt=""
              loading="lazy"
            />
          )}
        </div>
        {embed.imageUrl && (
          <img
            className="mt-1 max-h-32 w-full rounded object-cover"
            src={embed.imageUrl}
            alt=""
            loading="lazy"
          />
        )}
        {embed.footer && (
          <div className="mt-1 text-[0.6875rem] text-muted-foreground">
            {String(embed.footer)}
          </div>
        )}
      </div>
    </div>
  );
}
