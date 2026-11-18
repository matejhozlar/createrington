import type { DiscordMessageService } from "@/services/discord/message/message.service";
import { DiscordUsers } from "./users";
import { DiscordRolesNamespace } from "./roles";
import { DiscordChannelsNamespace } from "./channels";
import { DiscordCategoriesNamespace } from "./categories";

let messageService: DiscordMessageService | null = null;

export const Discord = {
  Roles: DiscordRolesNamespace,
  Channels: DiscordChannelsNamespace,
  Categories: DiscordCategoriesNamespace,
  Users: DiscordUsers,

  get Messages(): DiscordMessageService {
    if (!messageService) {
      throw new Error("Discord message service not initialized");
    }
    return messageService;
  },

  _setMessageService(service: DiscordMessageService) {
    messageService = service;
  },
};

export * from "./roles";
export * from "./channels";
