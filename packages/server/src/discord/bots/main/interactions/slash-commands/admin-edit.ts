import { db } from "@/db";
import { Discord } from "@/discord/constants";
import { EmbedPresets } from "@/discord/embeds";
import { confirmAdminChange } from "@/discord/utils/flows/confirmation/admin-confirmation";
import { DatabaseTable, type Player } from "@/generated/db";
import { AdminEdit } from "@/types";
import { minecraftRcon, WhitelistAction } from "@/utils/rcon";
import {
  type ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";

/**
 * Slash command definition for the admin-edit command
 * Administrative command for editing player and balance data with audit logging
 */
export const data = new SlashCommandBuilder()
  .setName("admin-edit")
  .setDescription("Edit player or balance data (Admin only)")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addUserOption((option) =>
    option
      .setName("user")
      .setDescription("Discord user to edit")
      .setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName("action")
      .setDescription("What to update")
      .setRequired(true)
      .addChoices(
        { name: "Minecraft Username", value: "username" },
        { name: "Minecraft UUID", value: "uuid" },
        { name: "Full Account (re-fetch from PlayerDB)", value: "account" },
        { name: "Balance", value: "balance" },
      ),
  )
  .addStringOption((option) =>
    option
      .setName("reason")
      .setDescription("Reason for this change")
      .setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName("value")
      .setDescription(
        "New value (not needed for 'Full Account' - will auto-fetch)",
      )
      .setRequired(false),
  );

/**
 * Whether this command should only be available in production
 * Set to false to allow usage in development mode
 */
export const prodOnly = false;

/**
 * Permission configuration for the admin-edit command
 * Requires administrator privileges to execute
 */
export const permissions = {
  requireAdmin: true,
};

/**
 * Executes the admin-edit command to modify player or balance data
 *
 * Process:
 * 1. Extract command options (target user, action type, value, reason)
 * 2. Validate that value is provided for actions that require it
 * 3. Look up the player record by Discord ID
 * 4. Route the appropriate handler ased on action type:
 *    - username: Update Minecraft username only
 *    - uuid: Update Minecraft UUID with cascade updates
 *    - account: Fetch and update both username and UUID from PlayerDB
 *    - balance: Update player balance with validation
 * 5. Each handler shows confirmation dialog with change preview
 * 6. On confirmation, perform update within transaction with audit logging
 * 7. Handle and report any errors that occur during the process
 *
 * @param interaction - The chat input command interaction
 * @returns Promise resolving when the command execution is completed
 */
export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const targetUser = interaction.options.getUser("user", true);
  const action = interaction.options.getString("action", true) as
    | "username"
    | "uuid"
    | "account"
    | "balance";
  const value = interaction.options.getString("value");
  const reason = interaction.options.getString("reason", true);

  if (action !== "account" && !value) {
    const embed = EmbedPresets.error(
      "Missing Value",
      "You must provide a value for this action",
    );
    await interaction.reply({
      embeds: [embed.build()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    const player = await db.player.find({ discordId: targetUser.id });

    if (!player) {
      const embed = EmbedPresets.error(
        "Player Not Found",
        `${Discord.Users.mention(
          targetUser.id,
        )} is not registered in the system`,
      );
      await interaction.reply({
        embeds: [embed.build()],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (action === "username") {
      await handleUsernameUpdate(
        interaction,
        player,
        value!,
        reason,
        targetUser.id,
      );
    } else if (action === "uuid") {
      await handleUuidUpdate(
        interaction,
        player,
        value!,
        reason,
        targetUser.id,
      );
    } else if (action === "account") {
      await handleFullAccountUpdate(interaction, player, reason, targetUser.id);
    } else if (action === "balance") {
      await handleBalanceUpdate(
        interaction,
        player,
        value!,
        reason,
        targetUser.id,
      );
    }
  } catch (error) {
    logger.error("Error in admin-edit command:", error);

    const embed = EmbedPresets.error(
      "Command Error",
      error instanceof Error ? error.message : "An unknown error occurred",
    );

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        embeds: [embed.build()],
        flags: MessageFlags.Ephemeral,
      });
    } else {
      await interaction.editReply({
        embeds: [embed.build()],
        components: [],
      });
    }
  }
}

/**
 * Handles updating a player's Minecraft username
 *
 * Process:
 * 1. Extract old username from player record
 * 2. Displays confirmation dialog with warnings about manual whitelist updates
 * 3. On confirmation, update username in transaction
 * 4. Log the action to admin audit log
 * 5. Reply with success message showing old and new values
 *
 * @param interaction - The chat input command interaction
 * @param player - The player record being updated
 * @param newUsername - The new Minecraft username
 * @param reason - Admin-provided reason for the change
 * @param targetDiscordId - Discord ID of the target player
 * @returns Promise resolving when the update is completed
 */
async function handleUsernameUpdate(
  interaction: ChatInputCommandInteraction,
  player: Player,
  newUsername: string,
  reason: string,
  targetDiscordId: string,
): Promise<void> {
  const oldUsername = player.minecraftUsername;

  const warnings = [
    "⚠️ This method should be used only if a player changed their username",
    "⚠️ This does not sync UUID with the new username, use 'Full Account' to update both",
    "✅ All related records (balance, playtime, etc.) will be updated automatically",
    "✅ Whitelist will be updated automatically",
  ];

  await confirmAdminChange({
    interaction,
    title: "Update Minecraft Username",
    description: `You are about to change the Minecraft username for **${oldUsername}** (${Discord.Users.mention(
      targetDiscordId,
    )})`,
    changes: [
      {
        name: "Minecraft Username",
        oldValue: oldUsername,
        newValue: newUsername,
      },
    ],
    warnings,
    reason,
    onConfirm: async () => {
      try {
        await db.inTransaction(async (tx) => {
          await tx.player.update(player, {
            minecraftUsername: newUsername,
          });

          await tx.admin.log.action.logAction({
            adminDiscordId: interaction.user.id,
            adminDiscordUsername: interaction.user.tag,
            actionType: AdminEdit.UPDATE_PLAYER,
            targetPlayerUuid: player.minecraftUuid,
            targetPlayerName: newUsername,
            tableName: DatabaseTable.PLAYER.TABLE,
            fieldName: DatabaseTable.PLAYER.FIELDS.MINECRAFT_USERNAME,
            oldValue: oldUsername,
            newValue: newUsername,
            reason,
            metadata: {
              commandUsed: "/edit-player",
              action: "username",
              targetDiscordId,
            },
          });
        });

        await minecraftRcon.whitelistAll(WhitelistAction.REMOVE, oldUsername);

        await minecraftRcon.whitelistAll(WhitelistAction.ADD, newUsername);

        const successEmbed = EmbedPresets.success(
          "Username Updated",
          `Successfully updated Minecraft username\n\n` +
            `**Old Username:** \`${oldUsername}\`\n` +
            `**New Username:** \`${newUsername}\`\n` +
            `**Reason:** ${reason}`,
        );

        await interaction.editReply({
          embeds: [successEmbed.build()],
          components: [],
        });

        logger.info(
          `Admin ${interaction.user.tag} updated username for ${player.minecraftUuid}: ${oldUsername} -> ${newUsername}`,
        );
      } catch (error) {
        throw error;
      }
    },
  });
}

/**
 * Handles updating a player's Minecraft UUID
 *
 * Process:
 * 1. Validate UUID format using regex pattern
 * 2. Display confirmation dialog with warnings about sensitivity of operation
 * 3. On confirmation, check for UUID conflicts with existing players
 * 4. Update UUID in transaction (cascades to related tables)
 * 5. Log the action to admin audit log
 * 6. Reply with success message confirming cascade updates
 *
 * @param interaction - The chat input command interaction
 * @param player - The player record being updated
 * @param newUuid - The new Minecraft UUID
 * @param reason - Admin-provided reason for the change
 * @param targetDiscordId - Discord ID of the target player
 * @returns Promise resolving when the update is completed
 */
async function handleUuidUpdate(
  interaction: ChatInputCommandInteraction,
  player: Player,
  newUuid: string,
  reason: string,
  targetDiscordId: string,
): Promise<void> {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(newUuid)) {
    const embed = EmbedPresets.error(
      "Invalid UUID",
      "The provided UUID is not in valid format (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)",
    );
    await interaction.reply({
      embeds: [embed.build()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const oldUuid = player.minecraftUuid;

  const warnings = [
    "⚠️ This method should not be used, only very special cases (username sync error)",
    "⚠️ This does not sync username with the new UUID, use 'Full Account' to update both",
    "✅ All related records (balance, playtime, etc.) will be updated automatically",
    "✅ Whitelist will be updated automatically",
  ];

  await confirmAdminChange({
    interaction,
    title: "Update Minecraft UUID",
    description: `You are about to change the Minecraft UUID for **${
      player.minecraftUsername
    }** (${Discord.Users.mention(targetDiscordId)})`,
    changes: [
      {
        name: "Minecraft UUID",
        oldValue: oldUuid,
        newValue: newUuid,
      },
    ],
    warnings,
    reason,
    onConfirm: async () => {
      try {
        const existingPlayer = await db.player.find({
          minecraftUuid: newUuid,
        });
        if (existingPlayer) {
          throw new Error(`A player with UUID ${newUuid} already exists`);
        }

        await db.inTransaction(async (tx) => {
          await tx.player.update(player, {
            minecraftUuid: newUuid,
          });

          await tx.admin.log.action.logAction({
            adminDiscordId: interaction.user.id,
            adminDiscordUsername: interaction.user.tag,
            actionType: AdminEdit.UPDATE_PLAYER,
            targetPlayerUuid: newUuid,
            targetPlayerName: player.minecraftUsername,
            tableName: DatabaseTable.PLAYER.TABLE,
            fieldName: DatabaseTable.PLAYER.FIELDS.MINECRAFT_UUID,
            oldValue: oldUuid,
            newValue: newUuid,
            reason,
            metadata: {
              commandUsed: "/edit-player",
              action: "uuid",
              targetDiscordId,
            },
          });
        });

        const successEmbed = EmbedPresets.success(
          "UUID Updated",
          `Successfully updated Minecraft UUID\n\n` +
            `**Old UUID:** \`${oldUuid}\`\n` +
            `**New UUID:** \`${newUuid}\`\n` +
            `**Reason:** ${reason}\n\n` +
            `✅ All related records updated automatically via CASCADE`,
        );

        await interaction.editReply({
          embeds: [successEmbed.build()],
          components: [],
        });

        logger.info(
          `Admin ${interaction.user.tag} updated UUID for ${player.minecraftUsername}: ${oldUuid} -> ${newUuid}`,
        );
      } catch (error) {
        throw error;
      }
    },
  });
}

/**
 * Handles updating a player's full account by fetching fresh data from PlayerDB
 *
 * Process:
 * 1. Defer reply to allow time for external API call
 * 2. Fetch current player data from PlayerDB API using existing username
 * 3. Validate API response and extract username and UUID
 * 4. Compare with existing data and exit early if no changes detected
 * 5. Display confirmation dialog showing all detected changes
 * 6. On confirmation, check for UUID conflicts if UUID is changing
 * 7. Update both username and UUID in transaction
 * 8. Log the action to admin audit log with metadata about what changed
 * 9. Reply with success message showing before/after values
 *
 * @param interaction - The chat input command interaction
 * @param player - The player record being updated
 * @param reason - Admin-provided reason for the change
 * @param targetDiscordId - Discord ID of the target player
 * @returns Promise resolving when the update is completed
 */
async function handleFullAccountUpdate(
  interaction: ChatInputCommandInteraction,
  player: Player,
  reason: string,
  targetDiscordId: string,
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const response = await fetch(
      `https://playerdb.co/api/player/minecraft/${player.minecraftUsername}`,
    );
    const result = (await response.json()) as any;

    if (!response.ok || !result.success || !result.data.player?.id) {
      const embed = EmbedPresets.error(
        "PlayerDB Fetch Failed",
        `Could not fetch data for \`${player.minecraftUsername}\` from PlayerDB`,
      );
      await interaction.editReply({
        embeds: [embed.build()],
      });
      return;
    }

    const newUuid = result.data.player.id as string;
    const newUsername = result.data.player.username as string;

    const oldUuid = player.minecraftUuid;
    const oldUsername = player.minecraftUsername;

    if (newUuid === oldUuid && newUsername === oldUsername) {
      const embed = EmbedPresets.info(
        "No Changes Detected",
        `Player data is already up to date with PlayerDB\n\n` +
          `**Username:** \`${newUsername}\`\n` +
          `**UUID:** \`${newUuid}\``,
      );
      await interaction.editReply({
        embeds: [embed.build()],
      });
      return;
    }

    const changes = [];
    if (newUsername !== oldUsername) {
      changes.push({
        name: "Minecraft Username",
        oldValue: oldUsername,
        newValue: newUsername,
      });
    }
    if (newUuid !== oldUuid) {
      changes.push({
        name: "Minecraft UUID",
        oldValue: oldUuid,
        newValue: newUuid,
      });
    }

    const warnings = [
      "⚠️ This will update the account based on current PlayerDB data",
      "⚠️ Make sure this is the correct player",
      "✅ Player will be whitelisted automatically",
    ];

    if (newUuid !== oldUuid) {
      warnings.push("✅ All related records will be updated automatically");
    }

    await confirmAdminChange({
      interaction,
      title: "Update Full Account",
      description: `You are about to update the Minecraft account for **${oldUsername}** (${Discord.Users.mention(
        targetDiscordId,
      )}) based on PlayerDB data`,
      changes,
      warnings,
      reason,
      isDeferred: true,
      onConfirm: async () => {
        try {
          if (newUuid !== oldUuid) {
            const existingPlayer = await db.player.find({
              minecraftUuid: newUuid,
            });
            if (existingPlayer) {
              throw new Error(`A player with UUID ${newUuid} already exists`);
            }
          }

          await db.inTransaction(async (tx) => {
            await tx.player.update(player, {
              minecraftUuid: newUuid,
              minecraftUsername: newUsername,
            });

            await tx.admin.log.action.logAction({
              adminDiscordId: interaction.user.id,
              adminDiscordUsername: interaction.user.tag,
              actionType: AdminEdit.UPDATE_PLAYER,
              targetPlayerUuid: newUuid,
              targetPlayerName: newUsername,
              tableName: DatabaseTable.PLAYER.TABLE,
              fieldName: "full_account",
              oldValue: JSON.stringify({
                username: oldUsername,
                uuid: oldUuid,
              }),
              newValue: JSON.stringify({
                username: newUsername,
                uuid: newUuid,
              }),
              reason,
              metadata: {
                commandUsed: "/edit-player",
                action: "account",
                targetDiscordId,
                source: "PlayerDB",
                uuidChanged: newUuid !== oldUuid,
                usernameChanged: newUsername !== oldUsername,
              },
            });
          });

          minecraftRcon.whitelistAll(WhitelistAction.REMOVE, oldUsername);

          minecraftRcon.whitelistAll(WhitelistAction.ADD, newUsername);

          const successEmbed = EmbedPresets.success(
            "Account Updated",
            `Successfully updated Minecraft account from PlayerDB\n\n` +
              `**Old Username:** \`${oldUsername}\`\n` +
              `**New Username:** \`${newUsername}\`\n` +
              `**Old UUID:** \`${oldUuid}\`\n` +
              `**New UUID:** \`${newUuid}\`\n` +
              `**Reason:** ${reason}`,
          );

          await interaction.editReply({
            embeds: [successEmbed.build()],
            components: [],
          });

          logger.info(
            `Admin ${interaction.user.tag} updated full account for ${targetDiscordId}: ${oldUsername}/${oldUuid} → ${newUsername}/${newUuid}`,
          );
        } catch (error) {
          throw error;
        }
      },
    });
  } catch (error) {
    logger.error("Error fetching from PlayerDB:", error);
    throw error;
  }
}

// At the top of the file, add the import
import { balanceRepo } from "@/db";
import { BalanceUtils } from "@/db/repositories/balance/utils";
import { BalanceTransactionType } from "@/db/repositories/balance";

/**
 * Handles updating a player's balance
 *
 * Process:
 * 1. Parse and validate the new balance value (must be numeric, non-negative, max 3 decimals)
 * 2. Fetch current balance from repository
 * 3. Calculate difference and add warnings for large changes (>10.000)
 * 4. Display confirmation dialog with old/new balance and difference
 * 5. On confirmation, use repository to set balance (logs transaction automatically)
 * 6. Reply with success message showing balance change details
 *
 * @param interaction - The chat input command interaction
 * @param player - The player record being updated
 * @param newValue - The new balance value as a string (e.g., "10.500", "0.200")
 * @param reason - Admin-provided reason for the change
 * @param targetDiscordId - Discord ID of the target player
 * @returns Promise resolving when the update is completed
 */
async function handleBalanceUpdate(
  interaction: ChatInputCommandInteraction,
  player: Player,
  newValue: string,
  reason: string,
  targetDiscordId: string,
): Promise<void> {
  // Parse and validate the new balance value
  const numericValue = parseFloat(newValue);
  if (isNaN(numericValue)) {
    const embed = EmbedPresets.error(
      "Invalid Value",
      "Balance must be a valid number",
    );
    await interaction.reply({
      embeds: [embed.build()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (numericValue < 0) {
    const embed = EmbedPresets.error(
      "Invalid Value",
      "Balance cannot be negative",
    );
    await interaction.reply({
      embeds: [embed.build()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Validate max 3 decimal places
  try {
    BalanceUtils.validate(numericValue);
  } catch (error) {
    const embed = EmbedPresets.error(
      "Invalid Value",
      error instanceof Error ? error.message : "Invalid balance value",
    );
    await interaction.reply({
      embeds: [embed.build()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Get current balance using repository
  const oldBalance = await balanceRepo.getAmount(player);
  const difference = numericValue - oldBalance;

  // Build warnings for large changes
  const warnings = [];
  if (difference > 10) {
    warnings.push(
      `⚠️ Large balance increase: +${BalanceUtils.format(BalanceUtils.toStorage(difference))}`,
    );
  } else if (difference < -10) {
    warnings.push(
      `⚠️ Large balance decrease: ${BalanceUtils.format(BalanceUtils.toStorage(difference))}`,
    );
  }

  await confirmAdminChange({
    interaction,
    title: "Update Balance",
    description: `You are about to change the balance for **${
      player.minecraftUsername
    }** (${Discord.Users.mention(targetDiscordId)})`,
    changes: [
      {
        name: "Balance",
        oldValue: BalanceUtils.format(BalanceUtils.toStorage(oldBalance)),
        newValue: BalanceUtils.format(BalanceUtils.toStorage(numericValue)),
      },
    ],
    warnings,
    reason,
    onConfirm: async () => {
      try {
        const newBalance = await balanceRepo.set(
          player,
          numericValue,
          reason,
          BalanceTransactionType.ADMIN_GRANT,
          {
            commandUsed: "/admin-edit",
            action: "balance",
            targetDiscordId,
            adminDiscordId: interaction.user.id,
            adminDiscordUsername: interaction.user.tag,
            difference,
          },
        );

        // Also log to admin audit log for admin actions tracking
        await db.admin.log.action.logAction({
          adminDiscordId: interaction.user.id,
          adminDiscordUsername: interaction.user.tag,
          actionType: AdminEdit.UPDATE_BALANCE,
          targetPlayerUuid: player.minecraftUuid,
          targetPlayerName: player.minecraftUsername,
          tableName: DatabaseTable.PLAYER_BALANCE.TABLE,
          fieldName: DatabaseTable.PLAYER_BALANCE.FIELDS.BALANCE,
          oldValue: String(oldBalance),
          newValue: String(numericValue),
          reason,
          metadata: {
            commandUsed: "/admin-edit",
            action: "balance",
            targetDiscordId,
            difference,
          },
        });

        const successEmbed = EmbedPresets.success(
          "Balance Updated",
          `Successfully updated balance for **${player.minecraftUsername}**\n\n` +
            `**Old Balance:** \`${BalanceUtils.format(BalanceUtils.toStorage(oldBalance))}\`\n` +
            `**New Balance:** \`${BalanceUtils.format(BalanceUtils.toStorage(newBalance))}\`\n` +
            `**Difference:** \`${difference > 0 ? "+" : ""}${BalanceUtils.format(BalanceUtils.toStorage(difference))}\`\n` +
            `**Reason:** ${reason}`,
        );

        await interaction.editReply({
          embeds: [successEmbed.build()],
          components: [],
        });

        logger.info(
          `Admin ${interaction.user.tag} updated balance for ${player.minecraftUsername}: ${oldBalance} → ${numericValue} (diff: ${difference})`,
        );
      } catch (error) {
        throw error;
      }
    },
  });
}
