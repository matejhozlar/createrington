import { ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DISCORD_INVITE_URL } from "@/lib/external-urls";

export function GalleryEmpty() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-primary/10">
        <ImageIcon className="size-7 text-primary" />
      </div>
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
