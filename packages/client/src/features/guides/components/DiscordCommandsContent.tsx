import { Badge } from "@/components/ui/badge";
import { Loading } from "@/components/loading-spinner";
import { Clock, ChevronDown, ChevronRight, Terminal } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";

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
  cooldown?: { duration: number; type: string; message?: string };
}

const OPTION_TYPE_LABELS: Record<number, string> = {
  3: "Text",
  4: "Number",
  5: "True/False",
  6: "Player",
  7: "Channel",
  10: "Number",
};

function formatCooldown(seconds: number): string {
  if (seconds < 60) return `${seconds}s cooldown`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m cooldown`;
}

function buildSyntax(name: string, options: CommandOption[]): string {
  const subcommands = options.filter((o) => o.type === 1 || o.type === 2);
  if (subcommands.length > 0) return `/${name} ...`;

  const params = options
    .map((o) => (o.required ? `<${o.name}>` : `[${o.name}]`))
    .join(" ");
  return params ? `/${name} ${params}` : `/${name}`;
}

function OptionRow({ option }: { option: CommandOption }) {
  const typeLabel = OPTION_TYPE_LABELS[option.type] ?? "Value";
  return (
    <div className="flex items-start gap-3 rounded-md bg-muted/30 px-3 py-2 text-sm">
      <code className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-foreground">
        {option.name}
      </code>
      <span className="shrink-0 text-xs text-muted-foreground">
        {typeLabel}
        {option.required && <span className="ml-1 text-red-400">*</span>}
      </span>
      <span className="text-muted-foreground">
        {option.description}
        {option.choices && option.choices.length > 0 && (
          <span className="ml-1 text-muted-foreground/70">
            ({option.choices.map((c) => c.name).join(", ")})
          </span>
        )}
      </span>
    </div>
  );
}

function SubcommandBlock({
  sub,
  prefix,
}: {
  sub: CommandOption;
  prefix?: string;
}) {
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

  const subcommands = command.options.filter(
    (o) => o.type === 1 || o.type === 2,
  );
  const topLevelOptions = command.options.filter(
    (o) => o.type !== 1 && o.type !== 2,
  );
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

        <div className="flex flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3">
          <code className="text-sm font-bold text-primary">
            {buildSyntax(command.name, command.options)}
          </code>
          <span className="text-sm text-muted-foreground">
            {command.description}
          </span>
        </div>

        {command.cooldown && (
          <Badge
            variant="outline"
            className="shrink-0 gap-1 border-border text-muted-foreground"
          >
            <Clock className="size-3" />
            {formatCooldown(command.cooldown.duration)}
          </Badge>
        )}
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
                  {sub.name}
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

export function DiscordCommandsContent() {
  const { data, isLoading } = trpc.public.discordCommands.list.useQuery();

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loading text="Loading commands..." />
      </div>
    );
  }

  const commands = (data?.commands ?? []) as CommandData[];

  if (commands.length === 0) {
    return <p className="text-muted-foreground">No commands available.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground mb-2">
        {commands.length} commands available. Click a command to see its options
        and usage details.
      </p>
      {commands.map((cmd) => (
        <CommandCard key={cmd.name} command={cmd} />
      ))}
    </div>
  );
}
