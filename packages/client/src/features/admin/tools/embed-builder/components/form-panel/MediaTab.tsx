import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, Divider } from "../form-primitives";
import type { TabProps } from "./types";

export function MediaTab({ data, set }: TabProps) {
  return (
    <>
      <Field
        label="Big image"
        right={
          data.imageUrl ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px] text-destructive"
              onClick={() => set({ imageUrl: undefined })}
            >
              Remove
            </Button>
          ) : null
        }
        hint="Renders below the embed body."
      >
        {data.imageUrl && (
          <div className="overflow-hidden rounded-md border border-border bg-muted">
            <img
              src={data.imageUrl}
              alt=""
              className="block max-h-48 w-full object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.opacity = "0.2";
              }}
            />
          </div>
        )}
        <Input
          value={data.imageUrl ?? ""}
          onChange={(e) => set({ imageUrl: e.target.value || undefined })}
          placeholder="https://..."
          className="mt-2 h-9 text-[13px]"
        />
      </Field>

      <Divider />

      <Field
        label="Thumbnail (top-right)"
        right={
          data.thumbnailUrl ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px] text-destructive"
              onClick={() => set({ thumbnailUrl: undefined })}
            >
              Remove
            </Button>
          ) : null
        }
        hint="Square image shown in the embed corner."
      >
        {data.thumbnailUrl && (
          <div className="overflow-hidden rounded-md border border-border bg-muted">
            <img
              src={data.thumbnailUrl}
              alt=""
              className="block size-24 object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.opacity = "0.2";
              }}
            />
          </div>
        )}
        <Input
          value={data.thumbnailUrl ?? ""}
          onChange={(e) => set({ thumbnailUrl: e.target.value || undefined })}
          placeholder="https://..."
          className="mt-2 h-9 text-[13px]"
        />
      </Field>
    </>
  );
}
