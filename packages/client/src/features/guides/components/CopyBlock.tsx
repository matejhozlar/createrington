import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

type CopyBlockProps = {
  label: string;
  value: string;
};

export function CopyBlock({ label, value }: CopyBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-mono text-sm truncate">{value}</p>
      </div>
      <Button variant="ghost" size="icon-sm" onClick={handleCopy}>
        {copied ? (
          <Check className="size-4 text-green-500" />
        ) : (
          <Copy className="size-4" />
        )}
      </Button>
    </div>
  );
}
