import type { LucideIcon } from "lucide-react";
import {
  Box,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  LayoutGrid,
  Minus,
  MousePointerClick,
  Plus,
  Trash2,
  Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type {
  ComponentActionRow,
  ComponentButton,
  ComponentContainer,
  ComponentMediaGallery,
  ComponentNode,
  ComponentSection,
  ComponentSeparator,
  ComponentTextDisplay,
} from "@createrington/shared/api/embed";
import type { UseEmbedBuilder } from "../hooks/use-embed-builder";
import { ColorPicker, TextField } from "../components/form-primitives";
import {
  moveItem,
  newActionRow,
  newButton,
  newContainer,
  newMediaGallery,
  newSection,
  newSeparator,
  newTextDisplay,
} from "./defaults";

type ContainerChild = ComponentContainer["components"][number];

const TYPE_LABELS: Record<ComponentNode["type"], string> = {
  container: "Container",
  text: "Text",
  section: "Section",
  media_gallery: "Media gallery",
  separator: "Separator",
  action_row: "Buttons",
};

const TOP_OPTIONS: AddOption<ComponentNode>[] = [
  { label: "Container", icon: Box, make: newContainer },
  { label: "Text", icon: Type, make: newTextDisplay },
  { label: "Section", icon: LayoutGrid, make: newSection },
  { label: "Media gallery", icon: ImageIcon, make: newMediaGallery },
  { label: "Separator", icon: Minus, make: newSeparator },
  { label: "Buttons", icon: MousePointerClick, make: newActionRow },
];

const CHILD_OPTIONS: AddOption<ContainerChild>[] = [
  { label: "Text", icon: Type, make: newTextDisplay },
  { label: "Section", icon: LayoutGrid, make: newSection },
  { label: "Media gallery", icon: ImageIcon, make: newMediaGallery },
  { label: "Separator", icon: Minus, make: newSeparator },
  { label: "Buttons", icon: MousePointerClick, make: newActionRow },
];

export function ComponentTreeEditor({ builder }: { builder: UseEmbedBuilder }) {
  const { components, setComponents } = builder;

  const update = (i: number, node: ComponentNode) =>
    setComponents((prev) => prev.map((n, idx) => (idx === i ? node : n)));
  const remove = (i: number) =>
    setComponents((prev) => prev.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) =>
    setComponents((prev) => moveItem(prev, i, dir));
  const add = (node: ComponentNode) => setComponents((prev) => [...prev, node]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Components</h2>
        <p className="text-xs text-muted-foreground">
          Build a Components V2 message. Containers without an accent color have
          no left stripe.
        </p>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {components.length === 0 && (
          <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
            No components yet. Add one to get started.
          </p>
        )}
        {components.map((node, i) => (
          <NodeCard
            key={i}
            node={node}
            index={i}
            total={components.length}
            onChange={(n) => update(i, n)}
            onRemove={() => remove(i)}
            onMove={(d) => move(i, d)}
          />
        ))}
        <AddMenu label="Add component" options={TOP_OPTIONS} onAdd={add} />
      </div>
    </div>
  );
}

interface NodeCardProps {
  node: ComponentNode;
  index: number;
  total: number;
  onChange: (node: ComponentNode) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}

function NodeCard({
  node,
  index,
  total,
  onChange,
  onRemove,
  onMove,
}: NodeCardProps) {
  return (
    <div className="rounded-md border border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border px-2 py-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {TYPE_LABELS[node.type]}
        </span>
        <div className="flex items-center gap-0.5">
          <IconButton
            icon={ChevronUp}
            label="Move up"
            onClick={() => onMove(-1)}
            disabled={index === 0}
          />
          <IconButton
            icon={ChevronDown}
            label="Move down"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
          />
          <IconButton
            icon={Trash2}
            label="Remove"
            onClick={onRemove}
            destructive
          />
        </div>
      </div>
      <div className="space-y-3 p-3">
        <NodeBody node={node} onChange={onChange} />
      </div>
    </div>
  );
}

function NodeBody({
  node,
  onChange,
}: {
  node: ComponentNode;
  onChange: (node: ComponentNode) => void;
}) {
  switch (node.type) {
    case "text":
      return <TextBody node={node} onChange={onChange} />;
    case "separator":
      return <SeparatorBody node={node} onChange={onChange} />;
    case "media_gallery":
      return <MediaGalleryBody node={node} onChange={onChange} />;
    case "section":
      return <SectionBody node={node} onChange={onChange} />;
    case "action_row":
      return <ActionRowBody node={node} onChange={onChange} />;
    case "container":
      return <ContainerBody node={node} onChange={onChange} />;
  }
}

function TextBody({
  node,
  onChange,
}: {
  node: ComponentTextDisplay;
  onChange: (node: ComponentTextDisplay) => void;
}) {
  return (
    <TextField
      label="Text"
      value={node.content}
      onChange={(v) => onChange({ ...node, content: v })}
      multiline
      rows={3}
      mentions
      ai
      max={4000}
      placeholder="Markdown supported"
    />
  );
}

function SeparatorBody({
  node,
  onChange,
}: {
  node: ComponentSeparator;
  onChange: (node: ComponentSeparator) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <label className="flex cursor-pointer items-center gap-2 text-[13px]">
        <Checkbox
          checked={node.divider}
          onCheckedChange={(c) => onChange({ ...node, divider: c === true })}
        />
        Divider line
      </label>
      <div className="flex items-center gap-2">
        <span className="text-[13px] text-muted-foreground">Spacing</span>
        <Select
          value={String(node.spacing)}
          onValueChange={(v) =>
            onChange({ ...node, spacing: v === "2" ? 2 : 1 })
          }
        >
          <SelectTrigger className="h-8 w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Small</SelectItem>
            <SelectItem value="2">Large</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function MediaGalleryBody({
  node,
  onChange,
}: {
  node: ComponentMediaGallery;
  onChange: (node: ComponentMediaGallery) => void;
}) {
  const items = node.items;
  const setItems = (next: ComponentMediaGallery["items"]) =>
    onChange({ ...node, items: next });

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="space-y-2 rounded-md border border-border p-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">
              Image {i + 1}
            </span>
            <IconButton
              icon={Trash2}
              label="Remove image"
              destructive
              disabled={items.length <= 1}
              onClick={() => setItems(items.filter((_, idx) => idx !== i))}
            />
          </div>
          <TextField
            label="Image URL"
            value={item.url}
            onChange={(v) =>
              setItems(
                items.map((it, idx) => (idx === i ? { ...it, url: v } : it)),
              )
            }
            placeholder="https://..."
          />
          <TextField
            label="Description (alt text)"
            value={item.description ?? ""}
            onChange={(v) =>
              setItems(
                items.map((it, idx) =>
                  idx === i ? { ...it, description: v || undefined } : it,
                ),
              )
            }
            max={1024}
          />
          <label className="flex cursor-pointer items-center gap-2 text-[13px]">
            <Checkbox
              checked={item.spoiler}
              onCheckedChange={(c) =>
                setItems(
                  items.map((it, idx) =>
                    idx === i ? { ...it, spoiler: c === true } : it,
                  ),
                )
              }
            />
            Spoiler
          </label>
        </div>
      ))}
      {items.length < 10 && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setItems([...items, { url: "", spoiler: false }])}
        >
          <Plus className="mr-1.5 size-3.5" />
          Add image
        </Button>
      )}
    </div>
  );
}

function SectionBody({
  node,
  onChange,
}: {
  node: ComponentSection;
  onChange: (node: ComponentSection) => void;
}) {
  const texts = node.components;
  const setTexts = (next: ComponentSection["components"]) =>
    onChange({ ...node, components: next });

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {texts.map((text, i) => (
          <div key={i} className="rounded-md border border-border p-2">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">
                Text {i + 1}
              </span>
              <IconButton
                icon={Trash2}
                label="Remove text"
                destructive
                disabled={texts.length <= 1}
                onClick={() => setTexts(texts.filter((_, idx) => idx !== i))}
              />
            </div>
            <TextField
              label="Content"
              value={text.content}
              onChange={(v) =>
                setTexts(
                  texts.map((t, idx) => (idx === i ? { ...t, content: v } : t)),
                )
              }
              multiline
              mentions
              max={4000}
            />
          </div>
        ))}
        {texts.length < 3 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setTexts([...texts, newTextDisplay()])}
          >
            <Plus className="mr-1.5 size-3.5" />
            Add text
          </Button>
        )}
      </div>

      <div className="space-y-2 rounded-md border border-border p-2">
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-muted-foreground">Accessory</span>
          <Select
            value={node.accessory.type}
            onValueChange={(v) =>
              onChange({
                ...node,
                accessory:
                  v === "button"
                    ? newButton()
                    : { type: "thumbnail", url: "", spoiler: false },
              })
            }
          >
            <SelectTrigger className="h-8 w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="thumbnail">Thumbnail</SelectItem>
              <SelectItem value="button">Button</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {node.accessory.type === "thumbnail" ? (
          <ThumbnailFields
            value={node.accessory}
            onChange={(accessory) => onChange({ ...node, accessory })}
          />
        ) : (
          <ButtonFields
            button={node.accessory}
            onChange={(accessory) => onChange({ ...node, accessory })}
          />
        )}
      </div>
    </div>
  );
}

function ThumbnailFields({
  value,
  onChange,
}: {
  value: Extract<ComponentSection["accessory"], { type: "thumbnail" }>;
  onChange: (
    next: Extract<ComponentSection["accessory"], { type: "thumbnail" }>,
  ) => void;
}) {
  return (
    <>
      <TextField
        label="Image URL"
        value={value.url}
        onChange={(v) => onChange({ ...value, url: v })}
        placeholder="https://..."
      />
      <TextField
        label="Description (alt text)"
        value={value.description ?? ""}
        onChange={(v) => onChange({ ...value, description: v || undefined })}
        max={1024}
      />
    </>
  );
}

function ActionRowBody({
  node,
  onChange,
}: {
  node: ComponentActionRow;
  onChange: (node: ComponentActionRow) => void;
}) {
  const buttons = node.components;
  const setButtons = (next: ComponentActionRow["components"]) =>
    onChange({ ...node, components: next });

  return (
    <div className="space-y-2">
      {buttons.map((button, i) => (
        <div key={i} className="space-y-2 rounded-md border border-border p-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">
              Button {i + 1}
            </span>
            <IconButton
              icon={Trash2}
              label="Remove button"
              destructive
              disabled={buttons.length <= 1}
              onClick={() => setButtons(buttons.filter((_, idx) => idx !== i))}
            />
          </div>
          <ButtonFields
            button={button}
            onChange={(b) =>
              setButtons(buttons.map((x, idx) => (idx === i ? b : x)))
            }
          />
        </div>
      ))}
      {buttons.length < 5 && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setButtons([...buttons, newButton()])}
        >
          <Plus className="mr-1.5 size-3.5" />
          Add button
        </Button>
      )}
    </div>
  );
}

function ButtonFields({
  button,
  onChange,
}: {
  button: ComponentButton;
  onChange: (button: ComponentButton) => void;
}) {
  return (
    <>
      <TextField
        label="Label"
        value={button.label}
        onChange={(v) => onChange({ ...button, label: v })}
        max={80}
      />
      <TextField
        label="URL"
        value={button.url}
        onChange={(v) => onChange({ ...button, url: v })}
        placeholder="https://..."
      />
      <TextField
        label="Emoji (optional)"
        value={button.emoji ?? ""}
        onChange={(v) => onChange({ ...button, emoji: v || undefined })}
        max={64}
        hint="Unicode emoji, or a custom emoji as <:name:id>"
      />
    </>
  );
}

function ContainerBody({
  node,
  onChange,
}: {
  node: ComponentContainer;
  onChange: (node: ComponentContainer) => void;
}) {
  const children = node.components as ComponentNode[];
  const setChildren = (next: ComponentNode[]) =>
    onChange({ ...node, components: next as ComponentContainer["components"] });

  return (
    <div className="space-y-3">
      <ColorPicker
        value={node.accentColor}
        onChange={(v) => onChange({ ...node, accentColor: v })}
      />
      <label className="flex cursor-pointer items-center gap-2 text-[13px]">
        <Checkbox
          checked={node.spoiler}
          onCheckedChange={(c) => onChange({ ...node, spoiler: c === true })}
        />
        Spoiler
      </label>

      <div className="space-y-2 border-l border-border pl-3">
        {children.map((child, i) => (
          <NodeCard
            key={i}
            node={child}
            index={i}
            total={children.length}
            onChange={(n) =>
              setChildren(children.map((c, idx) => (idx === i ? n : c)))
            }
            onRemove={() => setChildren(children.filter((_, idx) => idx !== i))}
            onMove={(d) => setChildren(moveItem(children, i, d))}
          />
        ))}
        <AddMenu
          label="Add to container"
          options={CHILD_OPTIONS}
          onAdd={(child) => setChildren([...children, child])}
        />
      </div>
    </div>
  );
}

interface AddOption<T> {
  label: string;
  icon: LucideIcon;
  make: () => T;
}

function AddMenu<T>({
  label,
  options,
  onAdd,
}: {
  label: string;
  options: AddOption<T>[];
  onAdd: (node: T) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-center">
          <Plus className="mr-1.5 size-3.5" />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {options.map((opt) => (
          <DropdownMenuItem key={opt.label} onClick={() => onAdd(opt.make())}>
            <opt.icon className="mr-2 size-3.5" />
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function IconButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  destructive,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        "size-6 text-muted-foreground",
        destructive && "hover:text-destructive",
      )}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
    >
      <Icon className="size-3.5" />
    </Button>
  );
}
