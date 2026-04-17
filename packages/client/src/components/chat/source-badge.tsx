import { MessageSource } from "@createrington/shared/socket";
import { cn } from "@/lib/utils";
import { SOURCE_CONFIG } from "./constants";

export function SourceBadge({ source }: { source: MessageSource }) {
  const config = SOURCE_CONFIG[source];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.25 text-[10px] font-semibold uppercase tracking-wider",
        config.bgColor,
        config.color,
      )}
    >
      {config.label}
    </span>
  );
}
