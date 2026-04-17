import { useEffect, useMemo } from "react";
import { X } from "lucide-react";

export function ImagePreview({
  file,
  onRemove,
}: {
  file: File;
  onRemove: () => void;
}) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => {
    return () => URL.revokeObjectURL(url);
  }, [url]);

  return (
    <div className="relative inline-block">
      <img
        src={url}
        alt="preview"
        className="h-20 w-20 rounded-lg object-cover ring-1 ring-border"
      />
      <button
        onClick={onRemove}
        className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 transition-colors hover:bg-destructive/90"
      >
        <X className="size-3 text-white cursor-pointer" />
      </button>
      <div className="absolute bottom-1 left-1 rounded bg-background/80 px-1.5 py-0.5 text-xs text-foreground backdrop-blur-sm">
        {(file.size / 1024 / 1024).toFixed(1)}MB
      </div>
    </div>
  );
}
