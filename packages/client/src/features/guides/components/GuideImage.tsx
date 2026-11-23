import { cn } from "@/lib/utils";

interface GuideImageProps {
  src: string;
  alt: string;
  bare?: boolean;
}

export function GuideImage({ src, alt, bare = false }: GuideImageProps) {
  return (
    <img
      src={src}
      alt={alt}
      className={cn(
        "mt-4 rounded-lg",
        !bare && "w-full border border-border bg-muted object-cover",
      )}
    />
  );
}
