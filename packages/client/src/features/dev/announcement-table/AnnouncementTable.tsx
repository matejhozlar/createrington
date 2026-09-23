import { useMemo, useRef, useState } from "react";
import { toBlob } from "html-to-image";
import { Copy, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToastActions } from "@/hooks/use-toast";
import { TableCard } from "./components/TableCard";
import { parseTable } from "./parse";

const PIXEL_RATIO = 2;

const EXAMPLE = `# Mission Rewards
Every mission now pays **5x more**.
| | Before | After |
|---|---:|---:|
| One mission | $1-16 | **$5-80** |
| 6 missions / week | ~$32 | **~$160** |
Averages, the exact reward is rolled per mission.`;

const SYNTAX_HINTS = [
  "# Title",
  "Lines before the table: intro",
  "Lines after the table: footnotes",
  "**text**: highlighted",
  "Empty first cell: groups with the row above",
  "|---:| right, |:---| left, |:---:| center",
];

function fileName(title: string) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug || "table"}.png`;
}

export function AnnouncementTable() {
  const [source, setSource] = useState(EXAMPLE);
  const cardRef = useRef<HTMLDivElement>(null);
  const toast = useToastActions();
  const table = useMemo(() => parseTable(source), [source]);

  const renderBlob = async () => {
    if (!cardRef.current) return null;
    return toBlob(cardRef.current, { pixelRatio: PIXEL_RATIO });
  };

  const handleCopy = async () => {
    const blob = await renderBlob();
    if (!blob) return toast.error("Could not render the image");
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    toast.success("Image copied, paste it into Discord");
  };

  const handleDownload = async () => {
    const blob = await renderBlob();
    if (!blob) return toast.error("Could not render the image");
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = fileName(table.title);
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex min-h-screen flex-col gap-6 bg-background p-6 lg:flex-row">
      <div className="flex w-full shrink-0 flex-col gap-4 lg:w-[420px]">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">Announcement Table</h1>
          <p className="text-sm text-muted-foreground">
            Paste a markdown table, then copy the image into Discord.
          </p>
        </div>

        <textarea
          value={source}
          onChange={(e) => setSource(e.target.value)}
          spellCheck={false}
          rows={16}
          className="w-full rounded-md border border-border bg-card px-3 py-2 font-mono text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />

        <div className="flex gap-2">
          <Button onClick={handleCopy}>
            <Copy />
            Copy image
          </Button>
          <Button variant="outline" onClick={handleDownload}>
            <Download />
            Download PNG
          </Button>
        </div>

        <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
          {SYNTAX_HINTS.map((hint) => (
            <li key={hint} className="font-mono">
              {hint}
            </li>
          ))}
        </ul>
      </div>

      <div className="min-w-0 flex-1 overflow-auto">
        <TableCard ref={cardRef} table={table} />
      </div>
    </div>
  );
}
