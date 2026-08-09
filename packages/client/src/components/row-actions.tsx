import type { LucideIcon } from "lucide-react";
import { Loader2, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const INLINE_LIMIT = 3;

export type RowAction = {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  variant?: React.ComponentProps<typeof Button>["variant"];
  disabled?: boolean;
};

function ActionButton({
  action,
  busy,
  spinner,
}: {
  action: RowAction;
  busy?: boolean;
  spinner?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="sm"
          variant={action.variant ?? "outline"}
          aria-label={action.label}
          disabled={action.disabled || busy}
          onClick={action.onClick}
        >
          {busy && spinner ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <action.icon className="size-4" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{action.label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Row action group for tables. Up to three actions render as icon buttons;
 * beyond that the first non destructive one stays exposed and the rest move
 * into a menu, so the column never grows past three slots.
 *
 * `max` is the largest number of actions any row in the table can offer, and
 * decides the layout for every row so the column does not switch shape
 * between rows. Pair it with `rowActionSlots(max)` on the header.
 */
export function RowActions({
  actions,
  max,
  busy,
}: {
  actions: RowAction[];
  max?: number;
  busy?: boolean;
}) {
  const inline = (max ?? actions.length) <= INLINE_LIMIT;

  if (inline) {
    return (
      <div className="flex justify-end gap-2">
        {actions.map((action, index) => (
          <ActionButton
            key={action.label}
            action={action}
            busy={busy}
            spinner={index === 0}
          />
        ))}
      </div>
    );
  }

  const primaryIndex = Math.max(
    actions.findIndex((action) => action.variant !== "destructive"),
    0,
  );
  const primary = actions[primaryIndex];
  const rest = actions.filter((_, index) => index !== primaryIndex);

  return (
    <div className="flex justify-end gap-2">
      {primary && <ActionButton action={primary} busy={busy} spinner />}
      {rest.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              aria-label="More actions"
              disabled={busy}
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {rest.map((action) => (
              <DropdownMenuItem
                key={action.label}
                disabled={action.disabled}
                onClick={action.onClick}
                className={
                  action.variant === "destructive"
                    ? "text-destructive focus:text-destructive"
                    : undefined
                }
              >
                <action.icon className="size-4" />
                {action.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
