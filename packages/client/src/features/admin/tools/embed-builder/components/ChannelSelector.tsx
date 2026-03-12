import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";

function formatCategoryName(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

function formatChannelName(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

interface ChannelSelectorProps {
  value: string;
  onChange: (channelId: string) => void;
}

export function ChannelSelector({ value, onChange }: ChannelSelectorProps) {
  const channelsQuery = trpc.admin.embeds.channels.useQuery();
  const groups = channelsQuery.data ?? [];

  return (
    <div className="space-y-2">
      <Label>Target Channel</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select a channel..." />
        </SelectTrigger>
        <SelectContent>
          {groups.map((group) => (
            <SelectGroup key={group.category}>
              <SelectLabel>{formatCategoryName(group.category)}</SelectLabel>
              {group.channels.map((ch) => (
                <SelectItem key={ch.id} value={ch.id}>
                  # {formatChannelName(ch.name)}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
