import { useState } from "react";
import { cn } from "@/lib/utils";
import type { EmbedData } from "@createrington/shared/api/embed";
import type { FocusTarget } from "../focus";
import { ContentTab } from "./form-panel/ContentTab";
import { MediaTab } from "./form-panel/MediaTab";
import { FieldsTab } from "./form-panel/FieldsTab";
import { ButtonsTab } from "./form-panel/ButtonsTab";
import { FooterTab } from "./form-panel/FooterTab";

const TAB_DEFS = [
  { id: "content", label: "Content" },
  { id: "media", label: "Media" },
  { id: "fields", label: "Fields" },
  { id: "buttons", label: "Buttons" },
  { id: "footer", label: "Footer" },
] as const;

export type TabId = (typeof TAB_DEFS)[number]["id"];

function tabForFocus(focus: FocusTarget): TabId | null {
  if (focus === "content" || focus === "title" || focus === "description")
    return "content";
  if (focus === "author" || focus === "color") return "content";
  if (focus === "imageUrl" || focus === "thumbnailUrl") return "media";
  if (focus === "footer") return "footer";
  if (focus === "fields:add" || focus.startsWith("field:")) return "fields";
  if (focus === "buttons:add" || focus.startsWith("button:")) return "buttons";
  return null;
}

interface FormPanelProps {
  data: EmbedData;
  onChange: (next: EmbedData) => void;
  focused: FocusTarget | null;
  setFocused: (next: FocusTarget | null) => void;
}

export function FormPanel({
  data,
  onChange,
  focused,
  setFocused,
}: FormPanelProps) {
  const [tab, setTab] = useState<TabId>("content");
  const [prevFocused, setPrevFocused] = useState(focused);

  if (focused !== prevFocused) {
    setPrevFocused(focused);
    if (focused) {
      const next = tabForFocus(focused);
      if (next) setTab(next);
    }
  }

  function set(updates: Partial<EmbedData>) {
    onChange({ ...data, ...updates });
  }

  const fieldsCount = data.fields.length;
  const buttonsCount =
    (data.buttons?.length ?? 0) + (data.actionButtons?.length ?? 0);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="sticky top-0 z-10 flex shrink-0 items-center gap-1 border-b border-border bg-card px-2">
        {TAB_DEFS.map((t) => {
          const count =
            t.id === "fields"
              ? fieldsCount
              : t.id === "buttons"
                ? buttonsCount
                : 0;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "relative inline-flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-medium transition-colors",
                active
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              {count > 0 && (
                <span
                  className={cn(
                    "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-accent text-foreground",
                  )}
                >
                  {count}
                </span>
              )}
              {active && (
                <span className="absolute inset-x-0 -bottom-px h-0.5 bg-primary" />
              )}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {tab === "content" && (
          <ContentTab
            data={data}
            set={set}
            focused={focused}
            setFocused={setFocused}
          />
        )}
        {tab === "media" && <MediaTab data={data} set={set} />}
        {tab === "fields" && (
          <FieldsTab
            data={data}
            set={set}
            focused={focused}
            setFocused={setFocused}
          />
        )}
        {tab === "buttons" && (
          <ButtonsTab
            data={data}
            set={set}
            focused={focused}
            setFocused={setFocused}
          />
        )}
        {tab === "footer" && <FooterTab data={data} set={set} />}
      </div>
    </div>
  );
}
