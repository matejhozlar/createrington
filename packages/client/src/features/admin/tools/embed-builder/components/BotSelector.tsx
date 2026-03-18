import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { EmbedBot } from "@createrington/shared/api/embed";

const BOTS: { value: EmbedBot; label: string }[] = [
  { value: "main", label: "Createrington" },
  { value: "web", label: "Createrington Web" },
];

interface BotSelectorProps {
  value: EmbedBot;
  onChange: (bot: EmbedBot) => void;
}

export function BotSelector({ value, onChange }: BotSelectorProps) {
  return (
    <div className="space-y-2">
      <Label>Bot</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {BOTS.map((bot) => (
            <SelectItem key={bot.value} value={bot.value}>
              {bot.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
