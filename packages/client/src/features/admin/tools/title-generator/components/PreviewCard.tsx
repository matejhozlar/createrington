import { useEffect, useRef, useState } from "react";
import { Copy, Download, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useClipboard } from "@/hooks/use-clipboard";
import { downloadBlob } from "@/lib/download";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";

const CHECKERBOARD: React.CSSProperties = {
  backgroundColor: "#2a2a2a",
  backgroundImage:
    "linear-gradient(45deg, #3a3a3a 25%, transparent 25%), linear-gradient(-45deg, #3a3a3a 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #3a3a3a 75%), linear-gradient(-45deg, transparent 75%, #3a3a3a 75%)",
  backgroundSize: "20px 20px",
  backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0",
};

function toBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Export failed"))),
      "image/png",
    ),
  );
}

export function PreviewCard({
  output,
  current,
  rendering,
  error,
  loading,
  fileName,
}: {
  output: HTMLCanvasElement | null;
  current: boolean;
  rendering: boolean;
  error: string | null;
  loading: boolean;
  fileName: string;
}) {
  const { copy: copyToClipboard } = useClipboard({
    success: "Title copied to clipboard",
  });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [blob, setBlob] = useState<{
    source: HTMLCanvasElement;
    blob: Blob;
  } | null>(null);

  useEffect(() => {
    const target = canvasRef.current;
    if (!target || !output) return;
    target.width = output.width;
    target.height = output.height;
    target.getContext("2d")?.drawImage(output, 0, 0);
    let cancelled = false;
    toBlob(output).then(
      (next) => {
        if (!cancelled) setBlob({ source: output, blob: next });
      },
      () => {
        if (!cancelled) setBlob(null);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [output]);

  const currentBlob =
    current && blob && blob.source === output ? blob.blob : null;

  const copy = () => {
    if (currentBlob) void copyToClipboard(currentBlob);
  };

  const download = () => {
    if (currentBlob) downloadBlob(currentBlob, `${fileName}.png`);
  };

  return (
    <Card className="gap-2">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <ImageIcon className="size-4 text-muted-foreground" />
          Preview
          {rendering && <Spinner className="size-4 text-muted-foreground" />}
        </CardTitle>
        <div className="flex items-center gap-3">
          {output && (
            <span className="text-sm tabular-nums text-muted-foreground">
              {output.width} x {output.height}
              {blob && ` · ${formatBytes(blob.blob.size)}`}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={copy}
            disabled={!currentBlob}
          >
            <Copy className="size-4" />
            Copy
          </Button>
          <Button size="sm" onClick={download} disabled={!currentBlob}>
            <Download className="size-4" />
            Download PNG
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div
          className="flex min-h-48 items-center justify-center overflow-hidden rounded-xl border border-border p-4"
          style={CHECKERBOARD}
        >
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : !output ? (
            <p className="text-sm text-muted-foreground">
              {loading || rendering
                ? "Rendering..."
                : "Nothing to render yet. Add some text."}
            </p>
          ) : null}
          <canvas
            ref={canvasRef}
            className={cn(
              "max-h-[22rem] max-w-full object-contain",
              (!output || error) && "hidden",
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
}
