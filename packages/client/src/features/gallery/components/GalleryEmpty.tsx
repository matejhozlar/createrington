import { Button } from "@/components/ui/button";
import { DISCORD_INVITE_URL } from "@/lib/external-urls";

interface GalleryEmptyProps {
  onBackToStart?: () => void;
}

export function GalleryEmpty({ onBackToStart }: GalleryEmptyProps) {
  if (onBackToStart) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground">
            Nothing on this page
          </h2>
          <p className="max-w-md text-sm text-muted-foreground">
            These screenshots moved while you were browsing.
          </p>
        </div>
        <Button variant="outline" onClick={onBackToStart}>
          Back to the start
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">
          No screenshots yet
        </h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Post a screenshot in the gallery submissions channel on Discord and it
          will show up here once an admin approves it.
        </p>
      </div>
      <Button asChild variant="outline">
        <a href={DISCORD_INVITE_URL} target="_blank" rel="noreferrer">
          Join the Discord
        </a>
      </Button>
    </div>
  );
}
