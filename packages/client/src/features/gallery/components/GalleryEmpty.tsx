import { Button } from "@/components/ui/button";

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
    <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
      <h2 className="text-lg font-semibold text-foreground">
        The gallery doesn't contain any images yet
      </h2>
    </div>
  );
}
