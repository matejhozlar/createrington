import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { camelCaseToTitle } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { useQuery } from "@tanstack/react-query";
import { Field, FieldLabel } from "@/components/ui/field";

interface ChannelSelectorProps {
  value: string;
  onChange: (channelId: string) => void;
}

export function ChannelSelector({ value, onChange }: ChannelSelectorProps) {
  const channelsQuery = useQuery(trpc.admin.embeds.channels.queryOptions());
  const groups = channelsQuery.data ?? [];

  return (
    <Field>
      <FieldLabel htmlFor="embed-channel">Target Channel</FieldLabel>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id="embed-channel" className="w-full">
          <SelectValue placeholder="Select a channel..." />
        </SelectTrigger>
        <SelectContent>
          {groups.map((group) => (
            <SelectGroup key={group.category}>
              <SelectLabel>{camelCaseToTitle(group.category)}</SelectLabel>
              {group.channels.map((ch) => (
                <SelectItem key={ch.id} value={ch.id}>
                  # {camelCaseToTitle(ch.name)}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
