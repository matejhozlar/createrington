import { useQuery } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { trpc } from "@/lib/trpc";
import { PersonChip } from "./PersonChip";

interface AssigneePickerProps {
  value: string[];
  onChange: (discordIds: string[]) => void;
  disabled?: boolean;
}

export function AssigneePicker({
  value,
  onChange,
  disabled,
}: AssigneePickerProps) {
  const adminsQuery = useQuery(trpc.admin.planning.admins.list.queryOptions());
  const admins = adminsQuery.data?.admins ?? [];
  const assigned = admins.filter((admin) => value.includes(admin.discordId));

  const toggle = (discordId: string, checked: boolean) =>
    onChange(
      checked
        ? [...value, discordId]
        : value.filter((existing) => existing !== discordId),
    );

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {assigned.map((admin) => (
        <PersonChip key={admin.discordId} person={admin} />
      ))}
      {assigned.length === 0 && (
        <span className="text-sm text-muted-foreground">Nobody yet</span>
      )}

      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || adminsQuery.isLoading}
          >
            <UserPlus className="size-4" />
            Assign
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-2">
          <ul className="flex max-h-64 flex-col overflow-y-auto">
            {admins.map((admin) => (
              <li key={admin.discordId}>
                <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent">
                  <Checkbox
                    checked={value.includes(admin.discordId)}
                    onCheckedChange={(checked) =>
                      toggle(admin.discordId, checked === true)
                    }
                  />
                  <PersonChip person={admin} />
                </label>
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
    </div>
  );
}
