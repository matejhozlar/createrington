import {
  type ChangeEvent,
  type ReactNode,
  type RefObject,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToastActions } from "@/hooks/use-toast";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { InsertMenu } from "@/features/admin/components/InsertMenu";
import { MentionAutocomplete } from "./MentionAutocomplete";

interface InsertableInputHandle {
  focus: () => void;
  insertAtCursor: (text: string) => void;
}

function useInsertable(
  ref: RefObject<InsertableInputHandle | null>,
  inputRef: RefObject<HTMLInputElement | HTMLTextAreaElement | null>,
  value: string,
  onChange: (next: string) => void,
): void {
  useImperativeHandle(
    ref,
    () => ({
      focus: () => inputRef.current?.focus(),
      insertAtCursor: (text: string) => {
        const el = inputRef.current;
        const pos = el?.selectionStart ?? value.length;
        const next = value.slice(0, pos) + text + value.slice(pos);
        onChange(next);
        requestAnimationFrame(() => {
          if (el) {
            const after = pos + text.length;
            el.selectionStart = el.selectionEnd = after;
            el.focus();
          }
        });
      },
    }),
    [inputRef, onChange, value],
  );
}

interface FieldProps {
  label: string;
  hint?: ReactNode;
  count?: number;
  max?: number;
  right?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
}

export function Field({
  label,
  hint,
  count,
  max,
  right,
  htmlFor,
  children,
}: FieldProps) {
  const showCount = count !== undefined && max !== undefined && count > 0;
  const overMax = showCount && count > max;
  const warnMax = showCount && !overMax && count > max * 0.9;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={htmlFor}
          className="text-[13px] font-medium text-foreground"
        >
          {label}
        </label>
        <div className="flex items-center gap-1.5">
          {showCount && (
            <span
              className={cn(
                "text-[11px] tabular-nums text-muted-foreground",
                warnMax && "text-amber-400",
                overMax && "text-destructive",
              )}
            >
              {count}/{max}
            </span>
          )}
          {right}
        </div>
      </div>
      {children}
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

const AI_ACTIONS = [
  { id: "rewrite", label: "Rewrite", hint: "Cleaner wording" },
  { id: "shorten", label: "Shorten", hint: "Cut filler" },
  { id: "punchier", label: "Make punchier", hint: "More energy" },
  { id: "grammar", label: "Fix grammar", hint: "Spelling & punctuation" },
  { id: "translate-en", label: "Translate to English", hint: "Any language" },
] as const;

type AIActionId = (typeof AI_ACTIONS)[number]["id"];

interface AIButtonProps {
  value: string;
  onApply: (next: string) => void;
  iconOnly?: boolean;
}

export function AIButton({ value, onApply, iconOnly }: AIButtonProps) {
  const [open, setOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<AIActionId | null>(null);
  const toast = useToastActions();
  const assistMutation = trpc.admin.ai.assist.useMutation();

  async function runAction(action: AIActionId) {
    if (!value.trim()) return;
    setPendingAction(action);
    try {
      const result = await assistMutation.mutateAsync({
        action,
        text: value,
      });
      onApply(result.text);
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "AI assist failed");
    } finally {
      setPendingAction(null);
    }
  }

  const isLoading = assistMutation.isPending;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {iconOnly ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="AI assist"
                className="flex size-7 items-center justify-center rounded-md text-primary transition-colors hover:bg-primary/10"
              >
                <Sparkles className="size-3.5" />
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="left">AI assist</TooltipContent>
        </Tooltip>
      ) : (
        <PopoverTrigger asChild>
          <button
            type="button"
            title="AI assist"
            className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary/20"
          >
            <Sparkles className="size-3" />
            AI
          </button>
        </PopoverTrigger>
      )}
      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={4}
        className="w-64 p-1"
      >
        <div className="border-b border-border px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          AI assist
        </div>
        {AI_ACTIONS.map((a) => {
          const isThisLoading = pendingAction === a.id;
          return (
            <button
              key={a.id}
              type="button"
              disabled={!value || isLoading}
              onClick={() => runAction(a.id)}
              className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="font-medium text-foreground">{a.label}</span>
              <span className="text-[11px] text-muted-foreground">
                {isThisLoading ? "Working…" : a.hint}
              </span>
            </button>
          );
        })}
        {!value && (
          <div className="px-2 py-1.5 text-[11px] text-muted-foreground">
            Type something first.
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

interface TextFieldProps {
  label: string;
  value: string | undefined;
  onChange: (next: string) => void;
  placeholder?: string;
  max?: number;
  multiline?: boolean;
  rows?: number;
  hint?: ReactNode;
  mentions?: boolean;
  ai?: boolean;
  inputRef?: RefObject<InsertableInputHandle | null>;
  autoFocus?: boolean;
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  max,
  multiline = false,
  rows = 3,
  hint,
  mentions = false,
  ai = false,
  inputRef,
  autoFocus,
}: TextFieldProps) {
  const elRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const handleRef = useRef<InsertableInputHandle | null>(null);
  const v = value ?? "";
  const len = v.length;

  useInsertable(handleRef, elRef, v, onChange);
  useImperativeHandle(inputRef, () => handleRef.current!, []);

  function onIn(e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    onChange(e.target.value);
  }

  const insert = (text: string) => handleRef.current?.insertAtCursor(text);

  return (
    <Field
      label={label}
      hint={hint}
      count={max ? len : undefined}
      max={max}
      right={
        (mentions || ai) && (
          <div className="flex items-center gap-0.5">
            {mentions && <InsertMenu onInsert={insert} />}
            {ai && <AIButton value={v} onApply={onChange} />}
          </div>
        )
      }
    >
      <div className="relative">
        {multiline ? (
          <textarea
            ref={(el) => {
              elRef.current = el;
            }}
            autoFocus={autoFocus}
            value={v}
            rows={rows}
            maxLength={max}
            placeholder={placeholder}
            onChange={onIn}
            className="w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-[13px] shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
        ) : (
          <Input
            ref={(el) => {
              elRef.current = el;
            }}
            autoFocus={autoFocus}
            value={v}
            maxLength={max}
            placeholder={placeholder}
            onChange={onIn}
            className="h-9 text-[13px]"
          />
        )}
        {mentions && (
          <MentionAutocomplete inputRef={elRef} value={v} onChange={onChange} />
        )}
      </div>
    </Field>
  );
}

function numberToHex6(n: number | undefined): string {
  if (n === undefined) return "";
  return n.toString(16).padStart(6, "0").toUpperCase();
}

interface ColorPickerProps {
  value: number | undefined;
  onChange: (next: number | undefined) => void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const [hex, setHex] = useState(() => numberToHex6(value));
  const colorsQuery = trpc.admin.embeds.colors.useQuery();
  const colors = colorsQuery.data ?? [];

  const [prevValue, setPrevValue] = useState(value);
  if (prevValue !== value) {
    setPrevValue(value);
    setHex(numberToHex6(value));
  }

  function onHexChange(next: string) {
    const clean = next.replace("#", "").toUpperCase().slice(0, 6);
    setHex(clean);
    if (/^[0-9A-F]{6}$/.test(clean)) onChange(parseInt(clean, 16));
  }

  return (
    <Field
      label="Accent color"
      right={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-6 px-2 text-[11px] text-muted-foreground",
            value === undefined && "invisible",
          )}
          onClick={() => onChange(undefined)}
          aria-hidden={value === undefined}
          tabIndex={value === undefined ? -1 : 0}
        >
          Clear
        </Button>
      }
    >
      <div className="flex flex-wrap items-center gap-1.5">
        {colors.map((c) => {
          const selected = value === c.value;
          return (
            <button
              key={c.name}
              type="button"
              title={c.name}
              onClick={() => onChange(selected ? undefined : c.value)}
              className={cn(
                "size-[26px] rounded-md border-2 border-transparent transition-transform hover:scale-110",
                selected &&
                  "ring-2 ring-primary ring-offset-2 ring-offset-card",
              )}
              style={{ background: c.hex }}
            />
          );
        })}
        <label
          title="Pick any color"
          className="relative inline-flex size-[26px] cursor-pointer items-center justify-center rounded-md border-2 border-transparent transition-transform hover:scale-110"
          style={{
            background:
              "conic-gradient(from 0deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)",
          }}
        >
          <input
            type="color"
            value={value !== undefined ? `#${numberToHex6(value)}` : "#5865F2"}
            onChange={(e) => onChange(parseInt(e.target.value.slice(1), 16))}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          />
          <span className="pointer-events-none size-2 rounded-full bg-white shadow" />
        </label>
        <div className="mt-2 flex h-9 basis-full items-center overflow-hidden rounded-md border border-input bg-transparent w-fit">
          <span className="flex h-full items-center bg-muted px-2 text-[12px] font-medium text-muted-foreground">
            #
          </span>
          <input
            value={hex}
            onChange={(e) => onHexChange(e.target.value)}
            placeholder="5865F2"
            maxLength={6}
            className="h-full w-[88px] bg-transparent px-2 font-mono text-[12px] uppercase outline-none"
          />
        </div>
      </div>
    </Field>
  );
}

export type { InsertableInputHandle };
