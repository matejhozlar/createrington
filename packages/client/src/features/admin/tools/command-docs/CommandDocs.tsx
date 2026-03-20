import { useState } from "react";
import { Loading } from "@/components/loading-spinner";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Shield,
  ShieldAlert,
  Crown,
  Clock,
  Terminal,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc, type RouterOutput } from "@/lib/trpc";

type CommandsPayload = RouterOutput["admin"]["discordCommands"]["list"];

interface CommandOption {
  type: number;
  name: string;
  description: string;
  required?: boolean;
  choices?: { name: string; value: string | number }[];
  min_value?: number;
  max_value?: number;
  options?: CommandOption[];
}

interface CommandData {
  name: string;
  description: string;
  category: string;
  options: CommandOption[];
  defaultMemberPermissions: string | null;
  permissions?: { requireAdmin?: boolean; requireOwner?: boolean };
  cooldown?: { duration: number; type: string; message?: string };
  env: string;
}

const OPTION_TYPE_LABELS: Record<number, string> = {
  3: "String",
  4: "Integer",
  5: "Boolean",
  6: "User",
  7: "Channel",
  8: "Role",
  9: "Mentionable",
  10: "Number",
  11: "Attachment",
};

const CATEGORY_ORDER = ["admin", "user", "public"] as const;

const CATEGORY_META: Record<string, { label: string; color: string }> = {
  admin: { label: "Admin", color: "bg-red-500/10 text-red-400" },
  user: { label: "User", color: "bg-blue-500/10 text-blue-400" },
  public: { label: "Public", color: "bg-green-500/10 text-green-400" },
};

function PermissionBadge({ command }: { command: CommandData }) {
  if (command.permissions?.requireOwner) {
    return (
      <Badge variant="outline" className="gap-1 border-amber-500/30 text-amber-400">
        <Crown className="size-3" />
        Owner
      </Badge>
    );
  }
  if (command.permissions?.requireAdmin) {
    return (
      <Badge variant="outline" className="gap-1 border-red-500/30 text-red-400">
        <ShieldAlert className="size-3" />
        Admin
      </Badge>
    );
  }
  if (command.defaultMemberPermissions) {
    return (
      <Badge variant="outline" className="gap-1 border-orange-500/30 text-orange-400">
        <Shield className="size-3" />
        Discord Admin
      </Badge>
    );
  }
  return null;
}

function CooldownBadge({ cooldown }: { cooldown?: CommandData["cooldown"] }) {
  if (!cooldown) return null;
  return (
    <Badge variant="outline" className="gap-1 border-border text-muted-foreground">
      <Clock className="size-3" />
      {cooldown.duration}s
    </Badge>
  );
}

function formatOptionType(opt: CommandOption): string {
  const base = OPTION_TYPE_LABELS[opt.type] ?? `Type(${opt.type})`;
  if ((opt.type === 4 || opt.type === 10) && (opt.min_value != null || opt.max_value != null)) {
    const parts: string[] = [];
    if (opt.min_value != null) parts.push(`${opt.min_value}`);
    if (opt.max_value != null) parts.push(`${opt.max_value}`);
    return `${base} (${parts.join("–")})`;
  }
  return base;
}

function OptionRow({ option }: { option: CommandOption }) {
  return (
    <div className="flex items-start gap-3 rounded-md bg-muted/30 px-3 py-2 text-sm">
      <code className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-foreground">
        {option.name}
      </code>
      <span className="shrink-0 text-xs text-muted-foreground">
        {formatOptionType(option)}
        {option.required && <span className="ml-1 text-red-400">*</span>}
      </span>
      <span className="text-muted-foreground">
        {option.description}
        {option.choices && option.choices.length > 0 && (
          <span className="ml-1">
            ({option.choices.map((c) => c.name).join(", ")})
          </span>
        )}
      </span>
    </div>
  );
}

function SubcommandBlock({ sub, prefix }: { sub: CommandOption; prefix?: string }) {
  const label = prefix ? `${prefix} ${sub.name}` : sub.name;
  const opts = (sub.options ?? []).filter((o) => o.type !== 1 && o.type !== 2);

  return (
    <div className="rounded-md border border-border/50 bg-card/50 p-3">
      <div className="flex items-center gap-2">
        <code className="text-sm font-semibold text-foreground">{label}</code>
        <span className="text-sm text-muted-foreground">{sub.description}</span>
      </div>
      {opts.length > 0 && (
        <div className="mt-2 flex flex-col gap-1">
          {opts.map((o) => (
            <OptionRow key={o.name} option={o} />
          ))}
        </div>
      )}
    </div>
  );
}

function CommandCard({ command }: { command: CommandData }) {
  const [expanded, setExpanded] = useState(false);

  const subcommands = command.options.filter((o) => o.type === 1 || o.type === 2);
  const topLevelOptions = command.options.filter((o) => o.type !== 1 && o.type !== 2);
  const hasDetails = subcommands.length > 0 || topLevelOptions.length > 0;

  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        type="button"
        onClick={() => hasDetails && setExpanded(!expanded)}
        className={cn(
          "flex w-full items-center gap-3 p-4 text-left",
          hasDetails && "cursor-pointer hover:bg-accent/50 transition-colors",
        )}
      >
        {hasDetails ? (
          expanded ? (
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          )
        ) : (
          <Terminal className="size-4 shrink-0 text-muted-foreground" />
        )}

        <div className="flex flex-1 items-center gap-3">
          <code className="text-sm font-bold text-primary">/{command.name}</code>
          <span className="text-sm text-muted-foreground">{command.description}</span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <CooldownBadge cooldown={command.cooldown} />
          <PermissionBadge command={command} />
        </div>
      </button>

      {expanded && hasDetails && (
        <div className="flex flex-col gap-2 border-t border-border px-4 py-3">
          {topLevelOptions.length > 0 && (
            <div className="flex flex-col gap-1">
              {topLevelOptions.map((o) => (
                <OptionRow key={o.name} option={o} />
              ))}
            </div>
          )}

          {subcommands.map((sub) =>
            sub.type === 2 ? (
              <div key={sub.name} className="flex flex-col gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {sub.name} (group)
                </p>
                {(sub.options ?? [])
                  .filter((s) => s.type === 1)
                  .map((s) => (
                    <SubcommandBlock key={s.name} sub={s} prefix={sub.name} />
                  ))}
              </div>
            ) : (
              <SubcommandBlock key={sub.name} sub={sub} />
            ),
          )}
        </div>
      )}
    </div>
  );
}

export function CommandDocs() {
  const { data, isLoading } = trpc.admin.discordCommands.list.useQuery();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  if (isLoading) return <Loading mode="fullscreen" text="Loading commands..." />;

  const payload = data as CommandsPayload | undefined;
  const allCommands = (payload?.commands ?? []) as CommandData[];

  const filtered = allCommands.filter((cmd) => {
    if (categoryFilter && cmd.category !== categoryFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return cmd.name.includes(q) || cmd.description.toLowerCase().includes(q);
    }
    return true;
  });

  const grouped = new Map<string, CommandData[]>();
  for (const cmd of filtered) {
    const list = grouped.get(cmd.category) ?? [];
    list.push(cmd);
    grouped.set(cmd.category, list);
  }

  const sortedCategories = [...grouped.keys()].sort(
    (a, b) => CATEGORY_ORDER.indexOf(a as any) - CATEGORY_ORDER.indexOf(b as any),
  );

  return (
    <div className="flex flex-1 flex-col gap-4">
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border bg-sidebar px-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin/dashboard">Admin</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin/tools">Tools</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Command Docs</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <div className="flex flex-1 flex-col gap-4 px-4 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Discord Commands</h1>
            <p className="text-sm text-muted-foreground">
              {allCommands.length} commands registered
              {payload?.generatedAt && (
                <> · Generated {new Date(payload.generatedAt).toLocaleDateString()}</>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search commands..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setCategoryFilter(null)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                categoryFilter === null
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              All
            </button>
            {CATEGORY_ORDER.map((cat) => {
              const meta = CATEGORY_META[cat];
              const count = allCommands.filter((c) => c.category === cat).length;
              if (count === 0) return null;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    categoryFilter === cat
                      ? meta.color
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {meta.label} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {sortedCategories.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-muted-foreground">No commands match your search.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {sortedCategories.map((category) => {
              const cmds = grouped.get(category)!;
              const meta = CATEGORY_META[category] ?? {
                label: category,
                color: "bg-muted text-muted-foreground",
              };

              return (
                <section key={category}>
                  <div className="mb-3 flex items-center gap-2">
                    <h2 className="text-lg font-semibold">{meta.label} Commands</h2>
                    <Badge variant="secondary" className="text-xs">
                      {cmds.length}
                    </Badge>
                  </div>
                  <div className="flex flex-col gap-2">
                    {cmds.map((cmd) => (
                      <CommandCard key={cmd.name} command={cmd} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
