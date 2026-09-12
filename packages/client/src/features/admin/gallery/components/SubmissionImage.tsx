import { ExternalLink, ImageOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAuthedImage } from "../hooks/use-authed-image";

interface SubmissionImageProps {
  source: string | null;
  alt: string;
  className?: string;
}

export function SubmissionImage({
  source,
  alt,
  className,
}: SubmissionImageProps) {
  const { objectUrl, failed, loading } = useAuthedImage(source);

  return (
    <div
      className={cn(
        "group relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg border border-border bg-black/40",
        className,
      )}
    >
      {loading && <Skeleton className="absolute inset-0 rounded-none" />}
      {(failed || !source) && !loading && (
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <ImageOff className="size-8" />
          <span className="text-sm">
            {source ? "The original could not be loaded" : "No image stored"}
          </span>
        </div>
      )}
      {objectUrl && (
        <>
          <img
            src={objectUrl}
            alt={alt}
            className="max-h-full max-w-full object-contain"
          />
          <Button
            asChild
            variant="secondary"
            size="sm"
            className="absolute right-3 top-3 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          >
            <a href={objectUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-1.5 size-3.5" />
              Full size
            </a>
          </Button>
        </>
      )}
    </div>
  );
}
