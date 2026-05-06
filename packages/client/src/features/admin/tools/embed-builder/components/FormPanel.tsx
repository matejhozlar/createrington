import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  GripVertical,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type {
  EmbedActionButton,
  EmbedData,
  EmbedField,
  EmbedLinkButton,
} from "@createrington/shared/api/embed";
import {
  ColorPicker,
  Field,
  TextField,
  type InsertableInputHandle,
} from "./form-primitives";
import type { FocusTarget } from "../focus";

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

  useEffect(() => {
    if (!focused) return;
    const next = tabForFocus(focused);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (next) setTab(next);
  }, [focused]);

  function set(updates: Partial<EmbedData>) {
    onChange({ ...data, ...updates } as EmbedData);
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

interface TabProps {
  data: EmbedData;
  set: (updates: Partial<EmbedData>) => void;
  focused?: FocusTarget | null;
  setFocused?: (next: FocusTarget | null) => void;
}

function ContentTab({ data, set, focused, setFocused }: TabProps) {
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
        placeholder="Plain text sent above the embed (optional)"
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
        placeholder="Markdown supported · {user} <#channel> <@&role>"
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

function MediaTab({ data, set }: TabProps) {
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
          placeholder="Paste image URL — https://..."
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
          placeholder="Paste thumbnail URL — https://..."
          className="mt-2 h-9 text-[13px]"
        />
      </Field>
    </>
  );
}

function FieldsTab({ data, set, focused, setFocused }: TabProps) {
  const fields = data.fields;

  function update(i: number, updates: Partial<EmbedField>) {
    set({
      fields: fields.map((f, j) =>
        j === i ? ({ ...f, ...updates } as EmbedField) : f,
      ),
    });
  }
  function remove(i: number) {
    set({ fields: fields.filter((_, j) => j !== i) });
  }
  function add() {
    if (fields.length >= 25) return;
    set({ fields: [...fields, { name: "", value: "", inline: false }] });
    setFocused?.(`field:${fields.length}` as FocusTarget);
  }
  function move(i: number, dir: -1 | 1) {
    const next = [...fields];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    set({ fields: next });
  }
  function duplicate(i: number) {
    if (fields.length >= 25) return;
    const next = [...fields];
    next.splice(i + 1, 0, { ...fields[i] });
    set({ fields: next });
  }

  return (
    <>
      <SectionHead
        title="Fields"
        count={`${fields.length}/25`}
        right={
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-[11px]"
            disabled={fields.length >= 25}
            onClick={add}
          >
            <Plus className="mr-1 size-3" />
            Add field
          </Button>
        }
      />

      {fields.length === 0 && (
        <EmptyState
          title="No fields yet"
          hint="Fields are name/value rows shown below the description. Use them for structured info like server stats, links, or rules."
          actions={
            <Button variant="outline" size="sm" onClick={add}>
              <Plus className="mr-1 size-3.5" />
              Add your first field
            </Button>
          }
        />
      )}

      <div className="space-y-2">
        {fields.map((f, i) => (
          <FieldRow
            key={i}
            field={f}
            index={i}
            count={fields.length}
            focused={focused === `field:${i}`}
            onChange={(u) => update(i, u)}
            onRemove={() => remove(i)}
            onMove={(d) => move(i, d)}
            onDuplicate={() => duplicate(i)}
          />
        ))}
      </div>
    </>
  );
}

function FieldRow({
  field,
  index,
  count,
  focused,
  onChange,
  onRemove,
  onMove,
  onDuplicate,
}: {
  field: EmbedField;
  index: number;
  count: number;
  focused: boolean;
  onChange: (updates: Partial<EmbedField>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  onDuplicate: () => void;
}) {
  const nameRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (focused) nameRef.current?.focus();
  }, [focused]);

  return (
    <div
      className={cn(
        "flex gap-1 rounded-md border border-border bg-card p-2 transition-shadow",
        "hover:border-[var(--border-strong)] hover:shadow-sm",
        focused && "ring-2 ring-primary/40",
      )}
    >
      <button
        type="button"
        title="Drag to reorder (use arrows for now)"
        aria-label="Drag handle"
        className="mt-1 flex size-6 shrink-0 items-center justify-center text-muted-foreground"
      >
        <GripVertical className="size-4" />
      </button>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Input
            ref={nameRef}
            value={field.name}
            placeholder={`Field ${index + 1} name`}
            maxLength={256}
            onChange={(e) => onChange({ name: e.target.value })}
            className="h-8 flex-1 text-[13px]"
          />
          <label
            className={cn(
              "inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium transition-colors",
              field.inline
                ? "border-[var(--border-strong)] bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
            title="Render this field side-by-side with neighbors"
          >
            <input
              type="checkbox"
              checked={field.inline}
              onChange={(e) => onChange({ inline: e.target.checked })}
              className="size-3 accent-primary"
            />
            Inline
          </label>
        </div>
        <textarea
          value={field.value}
          placeholder="Value — supports markdown & mentions"
          rows={2}
          maxLength={1024}
          onChange={(e) => onChange({ value: e.target.value })}
          className="w-full resize-y rounded-md border border-input bg-transparent px-2.5 py-1.5 text-[13px] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      </div>
      <div className="flex shrink-0 flex-col gap-0.5">
        <RowIconButton
          title="Move up"
          disabled={index === 0}
          onClick={() => onMove(-1)}
        >
          <ArrowUp className="size-3.5" />
        </RowIconButton>
        <RowIconButton
          title="Move down"
          disabled={index === count - 1}
          onClick={() => onMove(1)}
        >
          <ArrowDown className="size-3.5" />
        </RowIconButton>
        <RowIconButton title="Duplicate" onClick={onDuplicate}>
          <Copy className="size-3.5" />
        </RowIconButton>
        <RowIconButton title="Delete" onClick={onRemove} destructive>
          <Trash2 className="size-3.5" />
        </RowIconButton>
      </div>
    </div>
  );
}

type ButtonItem =
  | { kind: "link"; btn: EmbedLinkButton; idx: number }
  | { kind: "action"; btn: EmbedActionButton; idx: number };

function ButtonsTab({ data, set, focused, setFocused }: TabProps) {
  const links = data.buttons ?? [];
  const actions = data.actionButtons ?? [];
  const total = links.length + actions.length;

  function setLink(i: number, updates: Partial<EmbedLinkButton>) {
    set({
      buttons: links.map((b, j) =>
        j === i ? ({ ...b, ...updates } as EmbedLinkButton) : b,
      ),
    });
  }
  function setAction(i: number, updates: Partial<EmbedActionButton>) {
    set({
      actionButtons: actions.map((b, j) =>
        j === i ? ({ ...b, ...updates } as EmbedActionButton) : b,
      ),
    });
  }
  function removeLink(i: number) {
    set({ buttons: links.filter((_, j) => j !== i) });
  }
  function removeAction(i: number) {
    set({ actionButtons: actions.filter((_, j) => j !== i) });
  }
  function addLink() {
    if (total >= 5) return;
    set({ buttons: [...links, { label: "", url: "" } as EmbedLinkButton] });
    setFocused?.(`button:link:${links.length}` as FocusTarget);
  }
  function addAction() {
    if (total >= 5) return;
    set({
      actionButtons: [
        ...actions,
        {
          label: "",
          action: "create_thread",
          channelId: "",
          threadName: "{username}'s thread",
          threadMessage: "Hey {user}, this thread was created for you!",
        } as EmbedActionButton,
      ],
    });
    setFocused?.(`button:action:${actions.length}` as FocusTarget);
  }
  function migrate(item: ButtonItem, target: "link" | "action") {
    if (item.kind === target) return;
    if (target === "link") {
      const promoted: EmbedLinkButton = {
        label: item.btn.label,
        url: "",
        emoji: item.btn.emoji,
      };
      set({
        actionButtons: actions.filter((_, j) => j !== item.idx),
        buttons: [...links, promoted],
      });
    } else {
      const promoted: EmbedActionButton = {
        label: item.btn.label,
        emoji: item.btn.emoji,
        action: "create_thread",
        channelId: "",
        threadName: "{username}'s thread",
        threadMessage: "Hey {user}!",
      };
      set({
        buttons: links.filter((_, j) => j !== item.idx),
        actionButtons: [...actions, promoted],
      });
    }
  }

  const items: ButtonItem[] = [
    ...links.map((b, i) => ({ kind: "link" as const, btn: b, idx: i })),
    ...actions.map((b, i) => ({ kind: "action" as const, btn: b, idx: i })),
  ];

  return (
    <>
      <SectionHead
        title="Buttons"
        count={`${total}/5`}
        right={
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-[11px]"
              disabled={total >= 5}
              onClick={addLink}
            >
              <Plus className="mr-1 size-3" />
              Link
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-[11px]"
              disabled={total >= 5}
              onClick={addAction}
            >
              <Plus className="mr-1 size-3" />
              Action
            </Button>
          </div>
        }
      />

      {total === 0 && (
        <EmptyState
          title="No buttons yet"
          hint={
            <>
              <strong className="text-foreground">Link</strong> buttons open
              URLs. <strong className="text-foreground">Action</strong> buttons
              run server logic, like opening a support thread.
            </>
          }
          actions={
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={addLink}>
                Add link button
              </Button>
              <Button variant="outline" size="sm" onClick={addAction}>
                Add action button
              </Button>
            </div>
          }
        />
      )}

      <div className="space-y-2">
        {items.map((item) => {
          const focusKey: FocusTarget =
            item.kind === "link"
              ? (`button:link:${item.idx}` as FocusTarget)
              : (`button:action:${item.idx}` as FocusTarget);
          return (
            <ButtonRow
              key={`${item.kind}-${item.idx}`}
              item={item}
              focused={focused === focusKey}
              onChangeLink={(u) => setLink(item.idx, u)}
              onChangeAction={(u) => setAction(item.idx, u)}
              onRemove={() =>
                item.kind === "link"
                  ? removeLink(item.idx)
                  : removeAction(item.idx)
              }
              onMigrate={(target) => migrate(item, target)}
            />
          );
        })}
      </div>
    </>
  );
}

function ButtonRow({
  item,
  focused,
  onChangeLink,
  onChangeAction,
  onRemove,
  onMigrate,
}: {
  item: ButtonItem;
  focused: boolean;
  onChangeLink: (updates: Partial<EmbedLinkButton>) => void;
  onChangeAction: (updates: Partial<EmbedActionButton>) => void;
  onRemove: () => void;
  onMigrate: (target: "link" | "action") => void;
}) {
  const labelRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (focused) labelRef.current?.focus();
  }, [focused]);

  return (
    <div
      className={cn(
        "flex gap-1 rounded-md border border-border bg-card p-2 transition-shadow",
        "hover:border-[var(--border-strong)] hover:shadow-sm",
        focused && "ring-2 ring-primary/40",
      )}
    >
      <button
        type="button"
        title="Drag to reorder (use buttons for now)"
        aria-label="Drag handle"
        className="mt-1 flex size-6 shrink-0 items-center justify-center text-muted-foreground"
      >
        <GripVertical className="size-4" />
      </button>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Segmented
            value={item.kind}
            options={[
              { value: "link", label: "Link" },
              { value: "action", label: "Action" },
            ]}
            onChange={(v) => onMigrate(v as "link" | "action")}
          />
          <Input
            value={item.btn.emoji ?? ""}
            placeholder="🔗"
            maxLength={4}
            onChange={(e) =>
              item.kind === "link"
                ? onChangeLink({ emoji: e.target.value || undefined })
                : onChangeAction({ emoji: e.target.value || undefined })
            }
            className="h-8 w-12 text-center text-[13px]"
          />
          <Input
            ref={labelRef}
            value={item.btn.label}
            placeholder="Label"
            maxLength={80}
            onChange={(e) =>
              item.kind === "link"
                ? onChangeLink({ label: e.target.value })
                : onChangeAction({ label: e.target.value })
            }
            className="h-8 flex-1 text-[13px]"
          />
        </div>

        {item.kind === "link" ? (
          <Input
            value={item.btn.url}
            placeholder="https://..."
            onChange={(e) => onChangeLink({ url: e.target.value })}
            className="h-8 text-[13px]"
          />
        ) : (
          <div className="space-y-1.5">
            <Input
              value={item.btn.channelId}
              placeholder="Channel ID — paste from Discord"
              onChange={(e) => onChangeAction({ channelId: e.target.value })}
              className="h-8 text-[13px]"
            />
            <Input
              value={item.btn.threadName}
              placeholder="Thread name — {username}'s ticket"
              maxLength={100}
              onChange={(e) => onChangeAction({ threadName: e.target.value })}
              className="h-8 text-[13px]"
            />
            <textarea
              value={item.btn.threadMessage}
              placeholder="Welcome message — supports {user}, {date}"
              rows={2}
              maxLength={2000}
              onChange={(e) =>
                onChangeAction({ threadMessage: e.target.value })
              }
              className="w-full resize-y rounded-md border border-input bg-transparent px-2.5 py-1.5 text-[13px] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </div>
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-0.5">
        <RowIconButton title="Delete" onClick={onRemove} destructive>
          <Trash2 className="size-3.5" />
        </RowIconButton>
      </div>
    </div>
  );
}

function FooterTab({ data, set }: TabProps) {
  return (
    <>
      <TextField
        label="Footer text"
        value={data.footer}
        onChange={(v) => set({ footer: v || undefined })}
        max={2048}
        placeholder="Footer text"
        mentions
      />

      <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-card p-3 hover:border-[var(--border-strong)]">
        <Switch
          checked={!!data.timestamp}
          onCheckedChange={(checked) => set({ timestamp: checked })}
        />
        <div className="space-y-0.5">
          <div className="text-[13px] font-medium text-foreground">
            Include timestamp
          </div>
          <div className="text-xs text-muted-foreground">
            Shows the current time when the embed is sent.
          </div>
        </div>
      </label>
    </>
  );
}

function Divider() {
  return <div className="-mx-4 h-px bg-border" />;
}

function SectionHead({
  title,
  count,
  right,
}: {
  title: string;
  count?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
        {title}
        {count && (
          <span className="text-[11px] font-normal text-muted-foreground">
            {count}
          </span>
        )}
      </h3>
      {right}
    </div>
  );
}

function EmptyState({
  title,
  hint,
  actions,
}: {
  title: string;
  hint: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="space-y-2 rounded-md border border-dashed border-border bg-card/50 p-6 text-center">
      <div className="text-[14px] font-medium text-foreground">{title}</div>
      <div className="mx-auto max-w-[280px] text-xs leading-relaxed text-muted-foreground">
        {hint}
      </div>
      {actions && <div className="flex justify-center pt-1">{actions}</div>}
    </div>
  );
}

function Segmented({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-md border border-border bg-muted/30 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-sm px-2.5 py-1 text-[11px] font-medium transition-colors",
            value === o.value
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function RowIconButton({
  title,
  onClick,
  disabled,
  destructive,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          className={cn(
            "flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors",
            "hover:bg-accent hover:text-foreground",
            destructive && "hover:bg-destructive/10 hover:text-destructive",
            disabled && "pointer-events-none opacity-30",
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="left">{title}</TooltipContent>
    </Tooltip>
  );
}
