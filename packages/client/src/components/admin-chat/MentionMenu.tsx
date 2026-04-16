import { cn } from "@/lib/utils";
import type { RepoSuggestion } from "./types";

interface MentionMenuProps {
  matches: RepoSuggestion[];
  activeIndex: number;
  onSelect: (repo: RepoSuggestion) => void;
  onHover: (index: number) => void;
}

export function MentionMenu({
  matches,
  activeIndex,
  onSelect,
  onHover,
}: MentionMenuProps): React.JSX.Element | null {
  if (matches.length === 0) return null;

  return (
    <div
      role="listbox"
      className="absolute right-3 bottom-[calc(100%-0.25rem)] left-3 z-10 flex max-h-56 flex-col gap-0.5 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-lg"
    >
      {matches.map((repo, i) => (
        <button
          key={repo.fullName}
          type="button"
          role="option"
          aria-selected={i === activeIndex}
          // Prevent the textarea from losing focus before the click handler fires.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onSelect(repo)}
          onMouseEnter={() => onHover(i)}
          className={cn(
            "flex flex-col items-start gap-px rounded px-2 py-1.5 text-left text-[0.8125rem] text-foreground",
            i === activeIndex && "bg-accent",
          )}
        >
          <span className="font-medium">{repo.name}</span>
          {repo.description && (
            <span className="w-full overflow-hidden text-[0.6875rem] text-ellipsis whitespace-nowrap text-muted-foreground">
              {repo.description}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
