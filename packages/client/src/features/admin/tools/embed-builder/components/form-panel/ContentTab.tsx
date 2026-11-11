import { useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ColorPicker,
  TextField,
  type InsertableInputHandle,
  Divider,
  SectionHead,
} from "../form-primitives";
import type { TabProps } from "./types";

export function ContentTab({ data, set, focused, setFocused }: TabProps) {
  const titleRef = useRef<InsertableInputHandle | null>(null);
  const descRef = useRef<InsertableInputHandle | null>(null);
  const authorRef = useRef<InsertableInputHandle | null>(null);
  const contentRef = useRef<InsertableInputHandle | null>(null);

  useEffect(() => {
    if (focused === "author" && data.author === undefined) {
      set({ author: "" });
      return;
    }
    if (focused === "title") titleRef.current?.focus();
    else if (focused === "description") descRef.current?.focus();
    else if (focused === "author") authorRef.current?.focus();
    else if (focused === "content") contentRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused, data.author]);

  const showAuthor = data.author !== undefined;

  return (
    <>
      <TextField
        label="Message above embed"
        value={data.content}
        onChange={(v) => set({ content: v || undefined })}
        max={2000}
        multiline
        rows={2}
        placeholder="Optional text above the embed"
        mentions
        ai
        inputRef={contentRef}
      />

      <Divider />

      <TextField
        label="Title"
        value={data.title}
        onChange={(v) => set({ title: v || undefined })}
        max={256}
        placeholder="Embed title"
        mentions
        ai
        inputRef={titleRef}
      />
      <TextField
        label="Title link URL"
        value={data.url}
        onChange={(v) => set({ url: v || undefined })}
        placeholder="https://..."
        hint="Title becomes a clickable link."
      />
      <TextField
        label="Description"
        value={data.description}
        onChange={(v) => set({ description: v || undefined })}
        max={4096}
        multiline
        rows={5}
        placeholder="Supports markdown and mentions"
        mentions
        ai
        inputRef={descRef}
      />

      <Divider />

      <ColorPicker value={data.color} onChange={(c) => set({ color: c })} />

      <Divider />

      <SectionHead
        title="Author"
        right={
          showAuthor ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[11px] text-destructive"
              onClick={() => {
                setFocused?.(null);
                set({
                  author: undefined,
                  authorUrl: undefined,
                  authorIconUrl: undefined,
                });
              }}
            >
              Remove
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-[11px]"
              onClick={() => set({ author: "" })}
            >
              <Plus className="mr-1 size-3" />
              Add author
            </Button>
          )
        }
      />
      {showAuthor && (
        <>
          <TextField
            label="Name"
            value={data.author}
            onChange={(v) => set({ author: v })}
            max={256}
            placeholder="Author name"
            mentions
            inputRef={authorRef}
          />
          <TextField
            label="Link"
            value={data.authorUrl}
            onChange={(v) => set({ authorUrl: v || undefined })}
            placeholder="https://..."
          />
          <TextField
            label="Icon URL"
            value={data.authorIconUrl}
            onChange={(v) => set({ authorIconUrl: v || undefined })}
            placeholder="https://..."
          />
        </>
      )}
    </>
  );
}
