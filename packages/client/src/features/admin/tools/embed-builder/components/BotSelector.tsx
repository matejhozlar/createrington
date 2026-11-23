import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { EmbedBot } from "@createrington/shared/api/embed";
import { Field, FieldLabel } from "@/components/ui/field";

const BOTS: { value: EmbedBot; label: string }[] = [
  { value: "main", label: "Createrington" },
];

interface BotSelectorProps {
  value: EmbedBot;
  onChange: (bot: EmbedBot) => void;
}

export function BotSelector({ value, onChange }: BotSelectorProps) {
  if (BOTS.length < 2) return null;

  return (
    <Field>
      <FieldLabel htmlFor="embed-bot">Bot</FieldLabel>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id="embed-bot" className="w-full">
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
    </Field>
  );
}
