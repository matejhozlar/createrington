import { z } from "zod";
import { DISCORD_ID_REGEX } from "@createrington/shared/discord-id";

export const MC_UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const mcUuid = z
  .string()
  .trim()
  .regex(MC_UUID_REGEX, "Invalid Minecraft UUID");

export const MC_USERNAME_REGEX = /^[A-Za-z0-9_]{1,16}$/;

export const mcUsername = z
  .string()
  .trim()
  .regex(MC_USERNAME_REGEX, "Invalid Minecraft username");

export const discordId = z
  .string()
  .trim()
  .regex(DISCORD_ID_REGEX, "Invalid Discord ID");
