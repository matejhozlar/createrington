import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ChoiceField } from "@/components/choice-field";
import { useToastActions } from "@/hooks/use-toast";
import { sessionStore } from "@/lib/storage";
import {
  INSERT_EMBED_EVENT,
  PENDING_EMBED_KEY,
  INSERT_COMPONENTS_EVENT,
  PENDING_COMPONENTS_KEY,
} from "@/features/admin-chat/actions";
import {
  EMBED_MAX_BUTTONS,
  EMBED_MAX_FIELDS,
  type PresetKind,
} from "@createrington/shared/api/embed";
import { useEmbedBuilder } from "./hooks/use-embed-builder";
import { PresetSidebar } from "./components/PresetSidebar";
import { Topbar } from "./components/Topbar";
import { FormPanel } from "./components/FormPanel";
import { EmbedPreview } from "./components/EmbedPreview";
import { LinkedMessages } from "./components/LinkedMessages";
import { ComponentsPreview } from "./components-v2/ComponentsPreview";
import { ComponentTreeEditor } from "./components-v2/ComponentTreeEditor";
import { parsePayload } from "./payload";
import type { FocusTarget } from "./focus";

const MODE_LABELS: Record<PresetKind, string> = {
  embed: "Classic embed",
  components: "Components V2",
};

const ASSISTANT_INSERTS = [
  {
    kind: "embed",
    storageKey: PENDING_EMBED_KEY,
    event: INSERT_EMBED_EVENT,
    inserted: "Embed inserted from Createrington Assistant",
    invalid: "Assistant sent an invalid embed payload",
  },
  {
    kind: "components",
    storageKey: PENDING_COMPONENTS_KEY,
    event: INSERT_COMPONENTS_EVENT,
    inserted: "Components inserted from Createrington Assistant",
    invalid: "Assistant sent an invalid components payload",
  },
] as const;

function parseAssistantInsert(kind: PresetKind, raw: unknown) {
  if (!raw || typeof raw !== "object") return null;
  return parsePayload(kind, kind === "components" ? { components: raw } : raw);
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function EmbedBuilder() {
  const builder = useEmbedBuilder();
  const { state, setEmbed, importPayload } = builder;
  const toast = useToastActions();
  const [focused, setFocused] = useState<FocusTarget | null>(null);
  const [presetsOpen, setPresetsOpen] = useState(false);

  const handleEdit = (target: FocusTarget) => {
    const { fields, buttons, actionButtons, author } = state.embed;
    if (target === "fields:add") {
      if (fields.length >= EMBED_MAX_FIELDS) return;
      setEmbed((prev) => ({
        ...prev,
        fields: [...prev.fields, { name: "", value: "", inline: false }],
      }));
      setFocused(`field:${fields.length}`);
      return;
    }
    if (target === "buttons:add") {
      if (buttons.length + actionButtons.length >= EMBED_MAX_BUTTONS) return;
      setEmbed((prev) => ({
        ...prev,
        buttons: [...prev.buttons, { label: "New button", url: "" }],
      }));
      setFocused(`button:link:${buttons.length}`);
      return;
    }
    if (target === "author" && author === undefined) {
      setEmbed((prev) => ({ ...prev, author: "" }));
    }
    setFocused(target);
  };

  useEffect(() => {
    const insert = (
      { kind, inserted, invalid }: (typeof ASSISTANT_INSERTS)[number],
      raw: unknown,
    ) => {
      const payload = parseAssistantInsert(kind, raw);
      if (!payload) {
        toast.error(invalid);
        return;
      }
      importPayload(payload);
      toast.success(inserted);
    };

    const cleanups = ASSISTANT_INSERTS.map((source) => {
      const pending = sessionStore.get(source.storageKey);
      if (pending) {
        sessionStore.remove(source.storageKey);
        insert(source, parseJson(pending));
      }
      const handler = (e: Event) => {
        const detail = (e as CustomEvent<unknown>).detail;
        if (detail) insert(source, detail);
      };
      window.addEventListener(source.event, handler);
      return () => window.removeEventListener(source.event, handler);
    });
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [importPayload, toast]);

  const sidebarProps = {
    activePresetId: state.activePreset?.id,
    isDirty: builder.isDirty,
    onLoad: builder.loadPreset,
    onNew: builder.reset,
    actions: builder.presetActions,
  };

  return (
    <div className="@container flex h-[calc(100svh-var(--mobile-nav-height))] min-h-0 flex-col">
      <Topbar builder={builder} onOpenPresets={() => setPresetsOpen(true)} />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="hidden @3xl:flex">
          <PresetSidebar {...sidebarProps} />
        </div>

        <Sheet open={presetsOpen} onOpenChange={setPresetsOpen}>
          <SheetContent
            side="left"
            showCloseButton={false}
            className="w-[85vw] max-w-[320px] gap-0 p-0"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Presets</SheetTitle>
              <SheetDescription>
                Browse, load and organize embed presets.
              </SheetDescription>
            </SheetHeader>
            <PresetSidebar
              {...sidebarProps}
              forceExpanded
              className="min-h-0 w-full flex-1 border-r-0"
              onNavigate={() => setPresetsOpen(false)}
            />
          </SheetContent>
        </Sheet>

        <main className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-card @3xl:flex-row @3xl:overflow-hidden">
          <section className="flex flex-col gap-3 bg-background p-4 @3xl:flex-1 @3xl:overflow-y-auto @3xl:p-6">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <ChoiceField
                value={state.kind}
                onChange={builder.setKind}
                options={(["embed", "components"] as const).map((kind) => ({
                  value: kind,
                  label: MODE_LABELS[kind],
                  disabled: !!state.activePreset && kind !== state.kind,
                }))}
              />
              <span className="text-xs text-muted-foreground">
                {state.kind === "components"
                  ? "Components V2 message"
                  : "Click anything to edit"}
              </span>
            </div>
            {state.kind === "components" ? (
              <ComponentsPreview components={state.components} />
            ) : (
              <EmbedPreview data={state.embed} editable onEdit={handleEdit} />
            )}
            {state.activePreset && (
              <div className="mt-2">
                <LinkedMessages
                  presetId={state.activePreset.id}
                  payload={builder.payload}
                  bot={state.bot}
                  validateOrToast={builder.validateOrToast}
                />
              </div>
            )}
          </section>

          <aside className="flex w-full shrink-0 flex-col border-t border-border bg-card @3xl:w-[380px] @3xl:border-l @3xl:border-t-0">
            {state.kind === "components" ? (
              <ComponentTreeEditor
                components={state.components}
                onChange={builder.setComponents}
              />
            ) : (
              <FormPanel
                data={state.embed}
                onChange={setEmbed}
                focused={focused}
                setFocused={setFocused}
              />
            )}
          </aside>
        </main>
      </div>
    </div>
  );
}
