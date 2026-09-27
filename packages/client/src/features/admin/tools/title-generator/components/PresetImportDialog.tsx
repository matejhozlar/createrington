import { useRef, useState } from "react";
import { FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

export function PresetImportDialog({
  open,
  onOpenChange,
  onImport,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (json: string) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const close = (next: boolean) => {
    if (!next) {
      setText("");
      setError(null);
    }
    onOpenChange(next);
  };

  const submit = async () => {
    setImporting(true);
    setError(null);
    try {
      await onImport(text);
      close(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid preset");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Preset</DialogTitle>
          <DialogDescription>
            Paste a preset or load its .json file. It replaces the selected
            layer's settings and keeps its text.
          </DialogDescription>
        </DialogHeader>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) setText(await file.text());
          }}
        />
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder='{"type":"minecraft_title_generator_preset","preset":{...}}'
          rows={8}
          className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={() => fileInput.current?.click()}>
            <FileUp className="size-4" />
            Load file
          </Button>
          <Button onClick={submit} disabled={!text.trim() || importing}>
            {importing && <Spinner />}
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
