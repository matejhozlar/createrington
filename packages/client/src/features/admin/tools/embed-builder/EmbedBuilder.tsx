import { useEffect, useState } from "react";
import { useToastActions } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  INSERT_EMBED_EVENT,
  PENDING_EMBED_KEY,
  INSERT_COMPONENTS_EVENT,
  PENDING_COMPONENTS_KEY,
} from "@/features/admin-chat/actions";
import {
  componentsDataSchema,
  type ComponentNode,
  type EmbedData,
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
import type { FocusTarget } from "./focus";

function normalizePartialEmbed(raw: unknown): Partial<EmbedData> {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const out: Partial<EmbedData> = {};

  const stringish = (v: unknown): string | undefined => {
    if (typeof v === "string") return v;
    if (v && typeof v === "object" && "text" in v) {
      const t = (v as { text?: unknown }).text;
      if (typeof t === "string") return t;
    }
    return undefined;
  };

  const urlish = (v: unknown): string | undefined => {
    if (typeof v === "string") return v;
    if (v && typeof v === "object" && "url" in v) {
      const u = (v as { url?: unknown }).url;
      if (typeof u === "string") return u;
    }
    return undefined;
  };

  if ("content" in r && typeof r.content === "string") out.content = r.content;
  if ("title" in r) out.title = stringish(r.title);
  if ("description" in r)
    out.description =
      typeof r.description === "string" ? r.description : undefined;
  if ("url" in r && typeof r.url === "string") out.url = r.url;
  if ("color" in r && typeof r.color === "number") out.color = r.color;
  if ("timestamp" in r && typeof r.timestamp === "boolean")
    out.timestamp = r.timestamp;

  if ("footer" in r) out.footer = stringish(r.footer);

  if ("author" in r) {
    const a = r.author;
    if (typeof a === "string") {
      out.author = a;
    } else if (a && typeof a === "object") {
      const obj = a as Record<string, unknown>;
      if (typeof obj.name === "string") out.author = obj.name;
      if (typeof obj.url === "string") out.authorUrl = obj.url;
      if (typeof obj.icon_url === "string") out.authorIconUrl = obj.icon_url;
    }
  }
  if ("authorUrl" in r && typeof r.authorUrl === "string")
    out.authorUrl = r.authorUrl;
  if ("authorIconUrl" in r && typeof r.authorIconUrl === "string")
    out.authorIconUrl = r.authorIconUrl;

  const imageUrl = urlish(r.image) ?? r.imageUrl;
  if (typeof imageUrl === "string") out.imageUrl = imageUrl;
  const thumbnailUrl = urlish(r.thumbnail) ?? r.thumbnailUrl;
  if (typeof thumbnailUrl === "string") out.thumbnailUrl = thumbnailUrl;

  if ("fields" in r && Array.isArray(r.fields)) {
    out.fields = r.fields
      .filter((f): f is Record<string, unknown> => !!f && typeof f === "object")
      .map((f) => ({
        name: typeof f.name === "string" ? f.name : "",
        value: typeof f.value === "string" ? f.value : "",
        inline: f.inline === true,
      }));
  }

  return out;
}

function applyPartialEmbed(
  setEmbedData: (updater: (prev: EmbedData) => EmbedData) => void,
  partial: unknown,
): void {
  const normalized = normalizePartialEmbed(partial);
  setEmbedData((prev) => ({
    ...prev,
    ...normalized,
    fields: normalized.fields ?? prev.fields,
    buttons: prev.buttons,
    actionButtons: prev.actionButtons,
  }));
}

function readPending(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function clearPending(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/**
 * Validate an assistant-supplied Components V2 payload and load it into the
 * builder in components mode. Returns false if the payload is invalid so the
 * caller can surface an error instead of silently applying garbage.
 */
function applyInsertedComponents(
  raw: unknown,
  setKind: (kind: PresetKind) => void,
  setComponents: (nodes: ComponentNode[]) => void,
): boolean {
  const result = componentsDataSchema.safeParse({ components: raw });
  if (!result.success) return false;
  setKind("components");
  setComponents(result.data.components);
  return true;
}

export function EmbedBuilder() {
  const builder = useEmbedBuilder();
  const toast = useToastActions();
  const [focused, setFocused] = useState<FocusTarget | null>(null);

  // Click handlers for the preview's "+ add field" and "+ add button"
  // affordances. We handle them here (not via a focus-driven useEffect)
  // so each click is an explicit, non-batched mutation tied to the user
  // action.
  const handleEdit = (target: FocusTarget) => {
    if (target === "fields:add") {
      if (builder.data.fields.length >= 25) return;
      const newIndex = builder.data.fields.length;
      builder.setEmbedData((prev) => ({
        ...prev,
        fields: [...prev.fields, { name: "", value: "", inline: false }],
      }));
      setFocused(`field:${newIndex}` as FocusTarget);
      return;
    }
    if (target === "buttons:add") {
      const total =
        (builder.data.buttons?.length ?? 0) +
        (builder.data.actionButtons?.length ?? 0);
      if (total >= 5) return;
      const newIndex = builder.data.buttons?.length ?? 0;
      builder.setEmbedData((prev) => ({
        ...prev,
        buttons: [...(prev.buttons ?? []), { label: "New button", url: "" }],
      }));
      setFocused(`button:link:${newIndex}` as FocusTarget);
      return;
    }
    setFocused(target);
  };

  const setEmbedData = builder.setEmbedData;
  const setKind = builder.setKind;
  const setComponents = builder.setComponents;
  useEffect(() => {
    // Classic embed insertions force embed mode so they aren't applied to a
    // hidden state while the builder is in components mode.
    const pendingEmbed = readPending(PENDING_EMBED_KEY);
    if (pendingEmbed) {
      try {
        const parsed = JSON.parse(pendingEmbed) as Partial<EmbedData>;
        setKind("embed");
        applyPartialEmbed(setEmbedData, parsed);
        toast.success("Embed inserted from Createrington Assistant");
      } catch {
        toast.error("Assistant sent an invalid embed payload");
      } finally {
        clearPending(PENDING_EMBED_KEY);
      }
    }

    const pendingComponents = readPending(PENDING_COMPONENTS_KEY);
    if (pendingComponents) {
      try {
        const parsed = JSON.parse(pendingComponents);
        if (applyInsertedComponents(parsed, setKind, setComponents)) {
          toast.success("Components inserted from Createrington Assistant");
        } else {
          toast.error("Assistant sent an invalid components payload");
        }
      } catch {
        toast.error("Assistant sent an invalid components payload");
      } finally {
        clearPending(PENDING_COMPONENTS_KEY);
      }
    }

    const embedHandler = (e: Event): void => {
      const detail = (e as CustomEvent<Partial<EmbedData>>).detail;
      if (!detail) return;
      setKind("embed");
      applyPartialEmbed(setEmbedData, detail);
      toast.success("Embed inserted from Createrington Assistant");
    };
    const componentsHandler = (e: Event): void => {
      const detail = (e as CustomEvent<ComponentNode[]>).detail;
      if (!detail) return;
      if (applyInsertedComponents(detail, setKind, setComponents)) {
        toast.success("Components inserted from Createrington Assistant");
      } else {
        toast.error("Assistant sent an invalid components payload");
      }
    };
    window.addEventListener(INSERT_EMBED_EVENT, embedHandler);
    window.addEventListener(INSERT_COMPONENTS_EVENT, componentsHandler);
    return () => {
      window.removeEventListener(INSERT_EMBED_EVENT, embedHandler);
      window.removeEventListener(INSERT_COMPONENTS_EVENT, componentsHandler);
    };
  }, [setEmbedData, setKind, setComponents, toast]);

  const externalData = builder.externalData;

  return (
    <div className="flex h-svh min-h-0 flex-col">
      <Topbar builder={builder} />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="hidden md:flex">
          <PresetSidebar builder={builder} />
        </div>

        <main className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-background p-4 md:p-6 lg:flex-row lg:overflow-hidden lg:p-0">
          <section className="flex flex-1 flex-col gap-3 lg:overflow-y-auto lg:p-6">
            <div className="flex items-center justify-between">
              <ModeToggle
                kind={builder.kind}
                onChange={builder.setKind}
                disabled={!!builder.activePreset}
              />
              <span className="text-xs text-muted-foreground">
                {builder.kind === "components"
                  ? "Components V2 message"
                  : "Click anything to edit"}
              </span>
            </div>
            {builder.kind === "components" ? (
              <ComponentsPreview components={builder.components} />
            ) : (
              <EmbedPreview data={externalData} editable onEdit={handleEdit} />
            )}
            {builder.activePreset && (
              <div className="mt-2">
                <LinkedMessages builder={builder} />
              </div>
            )}
          </section>

          <aside className="flex w-full shrink-0 flex-col border-t border-border bg-card lg:w-[380px] lg:border-l lg:border-t-0">
            {builder.kind === "components" ? (
              <ComponentTreeEditor builder={builder} />
            ) : (
              <FormPanel
                data={externalData}
                onChange={builder.setEmbedData}
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

const MODE_LABELS: Record<PresetKind, string> = {
  embed: "Classic embed",
  components: "Components V2",
};

function ModeToggle({
  kind,
  onChange,
  disabled,
}: {
  kind: PresetKind;
  onChange: (kind: PresetKind) => void;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex rounded-md border border-border p-0.5">
      {(["embed", "components"] as const).map((k) => (
        <button
          key={k}
          type="button"
          disabled={disabled && kind !== k}
          onClick={() => onChange(k)}
          className={cn(
            "rounded px-2.5 py-1 text-xs font-medium transition-colors",
            kind === k
              ? "bg-accent text-foreground"
              : "text-muted-foreground hover:text-foreground",
            disabled && kind !== k && "cursor-not-allowed opacity-40",
          )}
        >
          {MODE_LABELS[k]}
        </button>
      ))}
    </div>
  );
}
