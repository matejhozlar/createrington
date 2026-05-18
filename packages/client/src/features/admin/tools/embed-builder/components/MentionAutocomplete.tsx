import {
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AtSign, Hash } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

type TriggerChar = "@" | "#";

interface ActiveTrigger {
  trigger: TriggerChar;
  query: string;
  start: number;
}

interface Suggestion {
  key: string;
  label: string;
  insert: string;
  kind: "channel" | "role" | "special";
}

const MAX_RESULTS = 8;

function formatName(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

function getActiveTrigger(
  value: string,
  cursorPos: number,
): ActiveTrigger | null {
  for (let i = cursorPos - 1; i >= 0; i--) {
    const ch = value[i];
    if (ch === "@" || ch === "#") {
      const prev = i === 0 ? "" : value[i - 1];
      if (i !== 0 && !/\s/.test(prev)) return null;
      const query = value.slice(i + 1, cursorPos);
      if (/\s/.test(query)) return null;
      return { trigger: ch, query, start: i };
    }
    if (/\s/.test(ch)) return null;
  }
  return null;
}

interface MentionAutocompleteProps {
  inputRef: RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  value: string;
  onChange: (next: string) => void;
}

export function MentionAutocomplete({
  inputRef,
  value,
  onChange,
}: MentionAutocompleteProps) {
  const [active, setActive] = useState<ActiveTrigger | null>(null);
  const [highlight, setHighlight] = useState(0);

  const channelsQuery = trpc.admin.embeds.channels.useQuery(undefined, {
    enabled: active?.trigger === "#",
  });
  const rolesQuery = trpc.admin.embeds.roles.useQuery(undefined, {
    enabled: active?.trigger === "@",
  });

  const suggestions = useMemo<Suggestion[]>(() => {
    if (!active) return [];
    const q = active.query.toLowerCase();
    const match = (name: string) => !q || name.toLowerCase().includes(q);

    if (active.trigger === "#") {
      const out: Suggestion[] = [];
      for (const group of channelsQuery.data ?? []) {
        for (const ch of group.channels) {
          const label = formatName(ch.name);
          if (match(label)) {
            out.push({
              key: `ch:${ch.id}`,
              label,
              insert: `<#${ch.id}>`,
              kind: "channel",
            });
            if (out.length >= MAX_RESULTS) return out;
          }
        }
      }
      return out;
    }

    const out: Suggestion[] = [];
    if (match("everyone")) {
      out.push({
        key: "everyone",
        label: "@everyone",
        insert: "@everyone",
        kind: "special",
      });
    }
    if (match("here")) {
      out.push({
        key: "here",
        label: "@here",
        insert: "@here",
        kind: "special",
      });
    }
    for (const role of rolesQuery.data ?? []) {
      const label = formatName(role.name);
      if (match(label)) {
        out.push({
          key: `role:${role.id}`,
          label,
          insert: `<@&${role.id}>`,
          kind: "role",
        });
        if (out.length >= MAX_RESULTS) break;
      }
    }
    return out.slice(0, MAX_RESULTS);
  }, [active, channelsQuery.data, rolesQuery.data]);

  useEffect(() => {
    setHighlight(0);
  }, [active?.trigger, active?.query]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;

    const update = () => {
      const start = el.selectionStart ?? value.length;
      const end = el.selectionEnd ?? start;
      if (start !== end) {
        setActive(null);
        return;
      }
      setActive(getActiveTrigger(value, start));
    };

    update();

    const onBlur = () => setActive(null);

    el.addEventListener("keyup", update);
    el.addEventListener("click", update);
    el.addEventListener("focus", update);
    el.addEventListener("select", update);
    el.addEventListener("blur", onBlur);
    return () => {
      el.removeEventListener("keyup", update);
      el.removeEventListener("click", update);
      el.removeEventListener("focus", update);
      el.removeEventListener("select", update);
      el.removeEventListener("blur", onBlur);
    };
  }, [inputRef, value]);

  const apply = useCallback(
    (s: Suggestion) => {
      const el = inputRef.current;
      if (!active || !el) return;
      const cursorPos = el.selectionStart ?? value.length;
      const before = value.slice(0, active.start);
      const after = value.slice(cursorPos);
      const insertion = `${s.insert} `;
      onChange(`${before}${insertion}${after}`);
      setActive(null);
      requestAnimationFrame(() => {
        const target = inputRef.current;
        if (!target) return;
        const newPos = before.length + insertion.length;
        target.selectionStart = target.selectionEnd = newPos;
        target.focus();
      });
    },
    [active, value, onChange, inputRef],
  );

  const stateRef = useRef({ suggestions, highlight, apply, active });
  stateRef.current = { suggestions, highlight, apply, active };

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const s = stateRef.current;
      if (!s.active || s.suggestions.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlight((h) => (h + 1) % s.suggestions.length);
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlight(
            (h) => (h - 1 + s.suggestions.length) % s.suggestions.length,
          );
          break;
        case "Enter":
        case "Tab": {
          const choice = s.suggestions[s.highlight];
          if (choice) {
            e.preventDefault();
            s.apply(choice);
          }
          break;
        }
        case "Escape":
          e.preventDefault();
          e.stopPropagation();
          setActive(null);
          break;
      }
    };

    el.addEventListener("keydown", onKeyDown as EventListener);
    return () => el.removeEventListener("keydown", onKeyDown as EventListener);
  }, [inputRef]);

  if (!active || suggestions.length === 0) return null;

  const headerLabel = active.trigger === "#" ? "Channels" : "Roles";

  return (
    <div
      role="listbox"
      className="absolute inset-x-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
    >
      <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {headerLabel}
        {active.query && (
          <span className="ml-1 normal-case text-muted-foreground/70">
            matching “{active.query}”
          </span>
        )}
      </div>
      {suggestions.map((s, i) => {
        const isActive = i === highlight;
        return (
          <button
            key={s.key}
            type="button"
            role="option"
            aria-selected={isActive}
            onMouseDown={(e) => {
              e.preventDefault();
              apply(s);
            }}
            onMouseEnter={() => setHighlight(i)}
            className={cn(
              "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm",
              isActive
                ? "bg-accent text-accent-foreground"
                : "hover:bg-accent/50",
            )}
          >
            {s.kind === "channel" && (
              <Hash className="size-3.5 text-muted-foreground" />
            )}
            {s.kind === "role" && (
              <AtSign className="size-3.5 text-muted-foreground" />
            )}
            {s.kind === "special" && (
              <AtSign className="size-3.5 text-amber-400" />
            )}
            <span className="truncate">{s.label}</span>
          </button>
        );
      })}
    </div>
  );
}
