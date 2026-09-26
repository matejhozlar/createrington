import { useCallback, useRef, useState } from "react";
import { Paperclip, Send } from "lucide-react";
import { useAuth } from "@/contexts/auth";
import { Button } from "@/components/ui/button";
import { messagesApi } from "@/services/api/user/messages";
import { ImagePreview } from "./image-preview";
import { useAutoResize } from "./hooks";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export function ChatComposer({ serverId }: { serverId: number | null }) {
  const { user } = useAuth();

  const [draft, setDraft] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useAutoResize(textareaRef, draft);

  const canSend = !!user && serverId !== null && !sending;
  const hasContent = !!draft.trim() || !!imageFile;

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        setError("Only image files are allowed");
        return;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        setError("Image must be 10 MB or smaller");
        return;
      }
      setError(null);
      setImageFile(file);
    },
    [],
  );

  const sendMessage = useCallback(async () => {
    if (!serverId || (!draft.trim() && !imageFile)) return;

    setSending(true);
    setError(null);

    try {
      await messagesApi.send(
        {
          serverId: serverId,
          content: draft.trim() || undefined,
        },
        imageFile || undefined,
      );

      setDraft("");
      setImageFile(null);
      textareaRef.current?.focus();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to send message",
      );
    } finally {
      setSending(false);
    }
  }, [serverId, draft, imageFile]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend && hasContent) sendMessage();
    }
  };

  return (
    <div className="border-t border-border bg-sidebar p-4">
      {imageFile && (
        <div className="mb-3">
          <ImagePreview file={imageFile} onRemove={() => setImageFile(null)} />
        </div>
      )}

      {error && (
        <div className="mb-3 rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
        />

        <Button
          variant="secondary"
          size="icon-lg"
          onClick={() => fileInputRef.current?.click()}
          disabled={!canSend}
        >
          <Paperclip className="size-5" />
        </Button>

        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!canSend}
          placeholder={user ? "Type a message..." : "Log in to send messages"}
          rows={1}
          className="flex-1 resize-none rounded-lg border border-border bg-sidebar-accent px-4 py-2.5 text-sm text-foreground placeholder-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-40 leading-[1.5] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/50"
        />

        <Button
          size="icon-lg"
          onClick={sendMessage}
          disabled={!canSend || !hasContent}
        >
          {sending ? (
            <div className="size-5 animate-spin rounded-full border-2 border-white/20 border-t-white"></div>
          ) : (
            <Send className="size-5" />
          )}
        </Button>
      </div>
    </div>
  );
}
