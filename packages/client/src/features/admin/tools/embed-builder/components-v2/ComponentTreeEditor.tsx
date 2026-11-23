import type { LucideIcon } from "lucide-react";
import {
  createContext,
  useContext,
  type Dispatch,
  type SetStateAction,
} from "react";
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
import {
  ACTION_ROW_MAX_BUTTONS,
  COMPONENTS_V2_MAX_COMPONENTS,
  COMPONENTS_V2_MAX_TEXT,
  MEDIA_GALLERY_MAX_ITEMS,
  SECTION_MAX_TEXTS,
  measureComponentsV2,
  type AnyComponentNode,
  type ComponentActionRow,
  type ComponentButton,
  type ComponentContainer,
  type ComponentMediaGallery,
  type ComponentNode,
  type ComponentSection,
  type ComponentSeparator,
  type ComponentTextDisplay,
  type ContainerChild,
} from "@createrington/shared/api/embed";
import { useItemKeys } from "@/features/admin/tools/embed-builder/hooks/use-item-keys";
import {
  ColorPicker,
  RowIconButton,
  TextField,
} from "@/features/admin/tools/embed-builder/components/form-primitives";
import { moveItem } from "@/lib/moveItem";
import {
  newActionRow,
  newButton,
  newContainer,
  newMediaGallery,
  newSection,
  newSeparator,
  newTextDisplay,
} from "./defaults";

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

interface ComponentTreeEditorProps {
  components: ComponentNode[];
  onChange: Dispatch<SetStateAction<ComponentNode[]>>;
}

export function ComponentTreeEditor({
  components,
  onChange: setComponents,
}: ComponentTreeEditorProps) {
  const itemKeys = useItemKeys(components.length);
  const { count } = measureComponentsV2(components);

  const update = (i: number, node: ComponentNode) =>
    setComponents((prev) => prev.map((n, idx) => (idx === i ? node : n)));
  const remove = (i: number) => {
    itemKeys.remove(i);
    setComponents((prev) => prev.filter((_, idx) => idx !== i));
  };
  const move = (i: number, dir: -1 | 1) => {
    itemKeys.move(i, dir);
    setComponents((prev) => moveItem(prev, i, dir));
  };
  const add = (node: ComponentNode) => setComponents((prev) => [...prev, node]);

  return (
    <RemainingContext value={COMPONENTS_V2_MAX_COMPONENTS - count}>
      <div className="flex h-full flex-col">
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold">Components</h2>
            <span
              className={cn(
                "text-[11px] tabular-nums text-muted-foreground",
                count > COMPONENTS_V2_MAX_COMPONENTS && "text-destructive",
              )}
            >
              {count}/{COMPONENTS_V2_MAX_COMPONENTS}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Build a Components V2 message. Containers without an accent color
            have no left stripe.
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
              key={itemKeys.keys[i]}
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
    </RemainingContext>
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
          <RowIconButton
            icon={ChevronUp}
            label="Move up"
            onClick={() => onMove(-1)}
            disabled={index === 0}
          />
          <RowIconButton
            icon={ChevronDown}
            label="Move down"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
          />
          <RowIconButton
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
      max={COMPONENTS_V2_MAX_TEXT}
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
  const itemKeys = useItemKeys(items.length);
  const remaining = useContext(RemainingContext);
  const setItems = (next: ComponentMediaGallery["items"]) =>
    onChange({ ...node, items: next });

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div
          key={itemKeys.keys[i]}
          className="space-y-2 rounded-md border border-border p-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">
              Image {i + 1}
            </span>
            <RowIconButton
              icon={Trash2}
              label="Remove image"
              destructive
              disabled={items.length <= 1}
              onClick={() => {
                itemKeys.remove(i);
                setItems(items.filter((_, idx) => idx !== i));
              }}
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
      {items.length < MEDIA_GALLERY_MAX_ITEMS && remaining > 0 && (
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
  const textKeys = useItemKeys(texts.length);
  const remaining = useContext(RemainingContext);
  const setTexts = (next: ComponentSection["components"]) =>
    onChange({ ...node, components: next });

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {texts.map((text, i) => (
          <div
            key={textKeys.keys[i]}
            className="rounded-md border border-border p-2"
          >
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">
                Text {i + 1}
              </span>
              <RowIconButton
                icon={Trash2}
                label="Remove text"
                destructive
                disabled={texts.length <= 1}
                onClick={() => {
                  textKeys.remove(i);
                  setTexts(texts.filter((_, idx) => idx !== i));
                }}
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
              max={COMPONENTS_V2_MAX_TEXT}
            />
          </div>
        ))}
        {texts.length < SECTION_MAX_TEXTS && remaining > 0 && (
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
  const buttonKeys = useItemKeys(buttons.length);
  const remaining = useContext(RemainingContext);
  const setButtons = (next: ComponentActionRow["components"]) =>
    onChange({ ...node, components: next });

  return (
    <div className="space-y-2">
      {buttons.map((button, i) => (
        <div
          key={buttonKeys.keys[i]}
          className="space-y-2 rounded-md border border-border p-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">
              Button {i + 1}
            </span>
            <RowIconButton
              icon={Trash2}
              label="Remove button"
              destructive
              disabled={buttons.length <= 1}
              onClick={() => {
                buttonKeys.remove(i);
                setButtons(buttons.filter((_, idx) => idx !== i));
              }}
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
      {buttons.length < ACTION_ROW_MAX_BUTTONS && remaining > 0 && (
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
        emojis
        hint="Unicode emoji, or type : to pick a bot emoji"
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
  const children = node.components;
  const childKeys = useItemKeys(children.length);
  const setChildren = (next: ContainerChild[]) =>
    onChange({ ...node, components: next });

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
            key={childKeys.keys[i]}
            node={child}
            index={i}
            total={children.length}
            onChange={(n) => {
              if (n.type === "container") return;
              setChildren(children.map((c, idx) => (idx === i ? n : c)));
            }}
            onRemove={() => {
              childKeys.remove(i);
              setChildren(children.filter((_, idx) => idx !== i));
            }}
            onMove={(d) => {
              childKeys.move(i, d);
              setChildren(moveItem(children, i, d));
            }}
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

const RemainingContext = createContext(Infinity);

interface AddOption<T> {
  label: string;
  icon: LucideIcon;
  make: () => T;
}

function AddMenu<T extends AnyComponentNode>({
  label,
  options,
  onAdd,
}: {
  label: string;
  options: AddOption<T>[];
  onAdd: (node: T) => void;
}) {
  const remaining = useContext(RemainingContext);
  const fits = (opt: AddOption<T>) =>
    measureComponentsV2([opt.make()]).count <= remaining;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={!options.some(fits)}>
        <Button variant="outline" size="sm" className="w-full justify-center">
          <Plus className="mr-1.5 size-3.5" />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {options.map((opt) => (
          <DropdownMenuItem
            key={opt.label}
            disabled={!fits(opt)}
            onClick={() => onAdd(opt.make())}
          >
            <opt.icon className="mr-2 size-3.5" />
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
