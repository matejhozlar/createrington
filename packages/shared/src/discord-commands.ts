export interface DiscordCommandOption {
  type: number;
  name: string;
  description: string;
  required?: boolean;
  choices?: { name: string; value: string | number }[];
  min_value?: number;
  max_value?: number;
  options?: DiscordCommandOption[];
}

export interface DiscordCommandDoc {
  name: string;
  description: string;
  category: string;
  options: DiscordCommandOption[];
  defaultMemberPermissions: string | null;
  permissions?: {
    requireAdmin?: boolean;
    requireOwner?: boolean;
  };
  cooldown?: {
    duration: number;
    type: string;
    message?: string;
  };
}

export interface DiscordCommandsDocument {
  generatedAt: string | null;
  commands: DiscordCommandDoc[];
}
