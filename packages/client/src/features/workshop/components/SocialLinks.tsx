import { cn } from "@/lib/utils";
import { DiscordIcon } from "@/components/icons/discord";
import { CurseForgeIcon } from "@/components/icons/curseforge";
import { isHttpUrl } from "../format";

const LINK_CLASS =
  "text-muted-foreground opacity-35 transition-[color,opacity] group-hover:opacity-100";

export function SocialLinks({
  discordThreadUrl,
  websiteUrl,
  iconClass = "size-5",
  className,
}: {
  discordThreadUrl?: string | null;
  websiteUrl?: string | null;
  iconClass?: string;
  className?: string;
}) {
  return (
    <>
      {isHttpUrl(discordThreadUrl) && (
        <a
          href={discordThreadUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Discuss on Discord"
          title="Discuss on Discord"
          onClick={(event) => event.stopPropagation()}
          className={cn(LINK_CLASS, "hover:text-[#5865F2]", className)}
        >
          <DiscordIcon className={iconClass} />
        </a>
      )}
      {isHttpUrl(websiteUrl) && (
        <a
          href={websiteUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="View on CurseForge"
          title="View on CurseForge"
          onClick={(event) => event.stopPropagation()}
          className={cn(LINK_CLASS, "hover:text-[#F16436]", className)}
        >
          <CurseForgeIcon className={iconClass} />
        </a>
      )}
    </>
  );
}
