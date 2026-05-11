import { Loading } from "@/components/loading-spinner";
import { Clock } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface CommandOption {
  type: number;
  name: string;
  description: string;
  required?: boolean;
  choices?: { name: string; value: string | number }[];
  options?: CommandOption[];
}

interface CommandData {
  name: string;
  description: string;
  options: CommandOption[];
  cooldown?: { duration: number; type: string; message?: string };
}

function buildSyntax(name: string, options: CommandOption[]): string {
  const subs = options.filter((o) => o.type === 1 || o.type === 2);
  if (subs.length > 0) return `/${name} <subcommand>`;

  const params = options
    .map((o) => (o.required ? `<${o.name}>` : `[${o.name}]`))
    .join(" ");
  return params ? `/${name} ${params}` : `/${name}`;
}

function formatCooldown(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m`;
}

function CommandEntry({ command }: { command: CommandData }) {
  const subs = command.options.filter((o) => o.type === 1 || o.type === 2);
  const topOpts = command.options.filter((o) => o.type !== 1 && o.type !== 2);

  return (
    <div className="rounded-lg border border-border bg-card/50 p-4">
      {/* Header: syntax + cooldown */}
      <div className="flex items-center justify-between gap-3">
        <code className="text-sm font-bold text-primary">
          {buildSyntax(command.name, command.options)}
        </code>
        {command.cooldown && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
            <Clock className="size-3" />
            {formatCooldown(command.cooldown.duration)}
          </span>
        )}
      </div>

      {/* Description */}
      <p className="text-sm text-muted-foreground mt-1.5">
        {command.description}
      </p>

      {/* Top-level options */}
      {topOpts.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {topOpts.map((o) => (
            <span
              key={o.name}
              className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs"
            >
              <code className="font-medium text-foreground">{o.name}</code>
              {o.required && <span className="text-red-400">*</span>}
              <span className="text-muted-foreground">— {o.description}</span>
            </span>
          ))}
        </div>
      )}

      {/* Subcommands */}
      {subs.length > 0 && (
        <div className="mt-3 flex flex-col gap-1.5">
          {subs.map((sub) =>
            sub.type === 2 ? (
              // Subcommand group
              (sub.options ?? [])
                .filter((s) => s.type === 1)
                .map((s) => (
                  <SubcommandRow
                    key={`${sub.name}-${s.name}`}
                    parentName={command.name}
                    groupName={sub.name}
                    sub={s}
                  />
                ))
            ) : (
              <SubcommandRow
                key={sub.name}
                parentName={command.name}
                sub={sub}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}

function SubcommandRow({
  parentName,
  groupName,
  sub,
}: {
  parentName: string;
  groupName?: string;
  sub: CommandOption;
}) {
  const opts = (sub.options ?? []).filter((o) => o.type !== 1 && o.type !== 2);
  const params = opts
    .map((o) => (o.required ? `<${o.name}>` : `[${o.name}]`))
    .join(" ");
  const prefix = groupName
    ? `/${parentName} ${groupName} ${sub.name}`
    : `/${parentName} ${sub.name}`;
  const syntax = params ? `${prefix} ${params}` : prefix;

  return (
    <div className="rounded bg-muted/40 px-3 py-2">
      <code className="text-xs font-semibold text-foreground">{syntax}</code>
      <span className="text-xs text-muted-foreground ml-2">
        {sub.description}
      </span>
    </div>
  );
}

/**
 * Renders commands for a specific group name.
 * Used as guide step content: each group becomes its own step.
 */
export function DiscordCommandsGroup({ group }: { group: string }) {
  const { data, isLoading, isError } =
    trpc.public.discordCommands.list.useQuery();

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loading text="Loading commands..." />
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-destructive">
        Failed to load commands. Please try again later.
      </p>
    );
  }

  const commands = (data?.groups?.find((g) => g.name === group)?.commands ??
    []) as CommandData[];

  if (commands.length === 0) {
    return <p className="text-muted-foreground">No commands in this group.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {commands.map((cmd) => (
        <CommandEntry key={cmd.name} command={cmd} />
      ))}
    </div>
  );
}
