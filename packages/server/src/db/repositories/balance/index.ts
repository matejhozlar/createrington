import { db, Q } from "@/db";
import { DatabaseTable, type DatabaseQueries } from "@/generated/db";
import type {
  Player,
  PlayerBalance,
  PlayerBalanceTransaction,
} from "@/generated/db";
import { BalanceUtils } from "./utils";

export type PlayerIdentifier =
  | { minecraftUuid: string }
  | { minecraftUsername: string }
  | { discordId: string }
  | Player
  | string;

export enum BalanceTransactionType {
  TRANSFER_SEND = "transfer_send",
  TRANSFER_RECEIVE = "transfer_receive",
  DEPOSIT = "deposit",
  WITHDRAW = "withdraw",
  ADMIN_GRANT = "admin_grant",
  ADMIN_DEDUCT = "admin_deduct",
  PURCHASE = "purchase",
  SALE = "sale",
  REWARD = "reward",
  REFUND = "refund",
  LOTTERY_ENTRY = "lottery_entry",
  LOTTERY_WIN = "lottery_win",
  LOTTERY_REFUND = "lottery_refund",
  CRYPTO_BUY = "crypto_buy",
  CRYPTO_SELL = "crypto_sell",
  OTHER = "other",
}

/**
 * Balance Repository
 *
 * Manages player currency balances and their full audit trail:
 * - Reads balances in raw, decimal, and formatted forms
 * - Adds, deducts, and sets balances within atomic DB transactions
 * - Transfers funds between two players atomically
 * - Logs every mutation to the transaction history table
 * - Exposes privileged admin operations that also write to the admin audit log
 *
 * NOTE: Balances are stored as bigint with 3 implicit decimal places
 * (e.g. 1500n represents $1.500). Use BalanceUtils for all conversions.
 */
export class BalanceRepository {
  constructor() {}

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  /**
   * Resolves various player identifier formats to a Minecraft UUID
   *
   * @param identifier - Player identifier (UUID string, typed object, or full Player)
   * @returns Promise resolving to Minecraft UUID
   * @private
   */
  private async resolvePlayerUuid(
    identifier: PlayerIdentifier,
  ): Promise<string> {
    if (typeof identifier === "string") return identifier;
    if ("minecraftUuid" in identifier && identifier.minecraftUuid) {
      return identifier.minecraftUuid;
    }
    const player = await db.player.get(identifier);
    return player.minecraftUuid;
  }

  /**
   * Records a balance transaction to the audit trail
   *
   * @param data - Transaction details including amounts, type, and optional metadata
   * @param txOverride - Optional transaction context to use instead of the default db instance
   * @private
   */
  private async logTransaction(
    data: {
      playerMinecraftUuid: string;
      amount: bigint;
      balanceBefore: bigint;
      balanceAfter: bigint;
      transactionType: string;
      description?: string;
      relatedPlayerUuid?: string;
      metadata?: Record<string, unknown>;
    },
    txOverride?: DatabaseQueries,
  ): Promise<void> {
    const dbInstance = txOverride ?? db;
    await dbInstance.player.balance.transaction.create({
      playerMinecraftUuid: data.playerMinecraftUuid,
      amount: data.amount,
      balanceBefore: data.balanceBefore,
      balanceAfter: data.balanceAfter,
      transactionType: data.transactionType,
      description: data.description,
      relatedPlayerUuid: data.relatedPlayerUuid,
      metadata: data.metadata || {},
    });

    logger.info(
      `Balance transaction: ${data.transactionType} - ${BalanceUtils.format(data.amount)} for ${data.playerMinecraftUuid}`,
    );
  }

  // ============================================================================
  // QUERY METHODS
  // ============================================================================

  /**
   * Gets player balance record
   *
   * @param identifier - Player identifier
   * @returns Full balance entity (includes raw bigint balance)
   */
  async get(identifier: PlayerIdentifier): Promise<PlayerBalance> {
    const uuid = await this.resolvePlayerUuid(identifier);
    return await db.player.balance.get({ minecraftUuid: uuid });
  }

  /**
   * Gets balance amount as a decimal number
   *
   * @param identifier - Player identifier
   * @returns Balance as a floating-point decimal (e.g. 1.5)
   *
   * @example
   * const amount = await balanceRepo.getAmount(player) // 1.5
   */
  async getAmount(identifier: PlayerIdentifier): Promise<number> {
    const uuid = await this.resolvePlayerUuid(identifier);
    const balanceBigInt = await db.player.balance.select.balance({
      minecraftUuid: uuid,
    });
    return BalanceUtils.fromStorage(balanceBigInt);
  }

  /**
   * Gets balance formatted as a fixed-decimal string
   *
   * @param identifier - Player identifier
   * @param decimals - Number of decimal places to show (default: 3)
   * @returns Formatted balance string (e.g. "1.500")
   *
   * @example
   * await balanceRepo.getFormatted(player) // "1.500"
   */
  async getFormatted(
    identifier: PlayerIdentifier,
    decimals: number = 3,
  ): Promise<string> {
    const uuid = await this.resolvePlayerUuid(identifier);
    const balanceBigInt = await db.player.balance.select.balance({
      minecraftUuid: uuid,
    });
    return BalanceUtils.format(balanceBigInt, decimals);
  }

  /**
   * Gets balance formatted as a string with trailing zeros removed
   *
   * @param identifier - Player identifier
   * @returns Trimmed balance string (e.g. "1.5" instead of "1.500")
   *
   * @example
   * await balanceRepo.getFormattedTrimmed(player) // "1.5" (instead of "1.500")
   */
  async getFormattedTrimmed(identifier: PlayerIdentifier): Promise<string> {
    const uuid = await this.resolvePlayerUuid(identifier);
    const balanceBigInt = await db.player.balance.select.balance({
      minecraftUuid: uuid,
    });
    return BalanceUtils.formatTrimmed(balanceBigInt);
  }

  /**
   * Gets raw balance as bigint (storage format, not user-facing)
   *
   * @param identifier - Player identifier
   * @returns Raw balance in storage format (e.g. 1500n for $1.500)
   */
  async getRaw(identifier: PlayerIdentifier): Promise<bigint> {
    const uuid = await this.resolvePlayerUuid(identifier);
    return await db.player.balance.select.balance({
      minecraftUuid: uuid,
    });
  }

  /**
   * Checks if a player has sufficient balance for a given amount
   *
   * @param identifier - Player identifier
   * @param amount - Required amount as a decimal (e.g. 0.200)
   * @returns True if the player's balance is greater than or equal to the required amount
   *
   * @example
   * if (await balanceRepo.hasSufficient(player, 0.200)) {
   *    // Player has at least 0.200
   * }
   */
  async hasSufficient(
    identifier: PlayerIdentifier,
    amount: number,
  ): Promise<boolean> {
    const uuid = await this.resolvePlayerUuid(identifier);
    const balance = await db.player.balance.select.balance({
      minecraftUuid: uuid,
    });
    const required = BalanceUtils.toStorage(amount);
    return balance >= required;
  }

  /**
   * Gets top N players by balance
   *
   * @param limit - Number of top players to return (default: 10)
   * @returns Array of { name, balance } sorted by balance DESC
   */
  async getTop(
    limit: number = 10,
  ): Promise<Array<{ name: string; balance: number }>> {
    return Q.player.balance.getTop(limit);
  }

  /**
   * Creates initial balance record for a new player
   *
   * @param playerMinecraftUuid - Player's Minecraft UUID
   * @param initialBalance - Starting balance (default: 0)
   * @returns Created balance record
   */
  async create(
    playerMinecraftUuid: string,
    initialBalance: number = 0,
  ): Promise<PlayerBalance> {
    const balanceBigInt = BalanceUtils.toStorage(initialBalance);

    const created = await db.player.balance.createAndReturn({
      minecraftUuid: playerMinecraftUuid,
      balance: balanceBigInt,
    });

    if (initialBalance > 0) {
      await this.logTransaction({
        playerMinecraftUuid,
        amount: balanceBigInt,
        balanceBefore: 0n,
        balanceAfter: balanceBigInt,
        transactionType: BalanceTransactionType.ADMIN_GRANT,
        description: "Initial balance",
      });
    }

    logger.info(
      `Created balance for ${playerMinecraftUuid} with $${BalanceUtils.format(balanceBigInt)}`,
    );

    return created;
  }

  // ============================================================================
  // TRANSACTION METHODS
  // ============================================================================

  /**
   * Adds balance to player's account
   *
   * @param identifier - Player identifier
   * @param amount - Amount to add (e.g. 1.500, 0.200)
   * @param reason - Transaction reason
   * @param type - Type of transaction
   * @param metadata - Additional context
   * @param txOverride - Optional outer transaction context; if provided the operation joins it instead of creating its own
   * @returns Promise resolving to the new balance
   *
   * @example
   * const newBalance = await balanceRepo.add(player, 0.200, "Buy token") // 1.700
   */
  async add(
    identifier: PlayerIdentifier,
    amount: number,
    reason: string,
    type: BalanceTransactionType,
    metadata?: Record<string, unknown>,
    txOverride?: DatabaseQueries,
  ): Promise<number> {
    if (amount <= 0) {
      throw new Error("Amount must be positive");
    }

    BalanceUtils.validate(amount);
    const uuid = await this.resolvePlayerUuid(identifier);
    const amountBigInt = BalanceUtils.toStorage(amount);

    return await (txOverride ?? db).inTransaction(async (tx) => {
      const current = await tx.player.balance.get({ minecraftUuid: uuid });

      if (BalanceUtils.wouldOverflow(current.balance, amount)) {
        throw new Error(`Cannot add ${amount}: would exceed maximum balance`);
      }

      const newBalance = BalanceUtils.add(current.balance, amountBigInt);

      await tx.player.balance.update(
        { minecraftUuid: uuid },
        { balance: newBalance },
      );

      await this.logTransaction(
        {
          playerMinecraftUuid: uuid,
          amount: amountBigInt,
          balanceBefore: current.balance,
          balanceAfter: newBalance,
          transactionType: type,
          description: reason,
          metadata,
        },
        tx,
      );

      return BalanceUtils.fromStorage(newBalance);
    });
  }

  /**
   * Deducts balance from a player's account
   *
   * @param identifier - Player identifier
   * @param amount - Amount to deduct (must be positive)
   * @param reason - Transaction reason
   * @param type - Type of transaction
   * @param metadata - Additional context
   * @param txOverride - Optional outer transaction context; if provided the operation joins it instead of creating its own
   * @returns Promise resolving to new balance
   * @throws Error if insufficient balance
   *
   * @example
   * const newBalance = await balanceRepo.deduct(player, 0.200, "Buy item");
   */
  async deduct(
    identifier: PlayerIdentifier,
    amount: number,
    reason: string,
    type: BalanceTransactionType,
    metadata?: Record<string, unknown>,
    txOverride?: DatabaseQueries,
  ): Promise<number> {
    if (amount <= 0) {
      throw new Error("Amount must be positive");
    }

    BalanceUtils.validate(amount);
    const uuid = await this.resolvePlayerUuid(identifier);
    const amountBigInt = BalanceUtils.toStorage(amount);

    return await (txOverride ?? db).inTransaction(async (tx) => {
      const current = await tx.player.balance.get({ minecraftUuid: uuid });

      if (current.balance < amountBigInt) {
        throw new Error(
          `Insufficient balance: has ${BalanceUtils.format(current.balance)}, needs ${BalanceUtils.format(amountBigInt)}`,
        );
      }

      const newBalance = BalanceUtils.subtract(current.balance, amountBigInt);

      await tx.player.balance.update(
        { minecraftUuid: uuid },
        { balance: newBalance },
      );

      await this.logTransaction(
        {
          playerMinecraftUuid: uuid,
          amount: -amountBigInt,
          balanceBefore: current.balance,
          balanceAfter: newBalance,
          transactionType: type,
          description: reason,
          metadata,
        },
        tx,
      );

      return BalanceUtils.fromStorage(newBalance);
    });
  }

  /**
   * Sets player balance to a specific amount
   *
   * @param identifier - Player identifier
   * @param amount - New balance amount
   * @param reason - Transaction reason
   * @param type - Transaction type
   * @param metadata - Additional context
   * @returns Promise resolving to new balance
   */
  async set(
    identifier: PlayerIdentifier,
    amount: number,
    reason: string,
    type: BalanceTransactionType,
    metadata?: Record<string, unknown>,
  ): Promise<number> {
    if (amount < 0) {
      throw new Error("Balance cannot be negative");
    }

    BalanceUtils.validate(amount);
    const uuid = await this.resolvePlayerUuid(identifier);
    const amountBigInt = BalanceUtils.toStorage(amount);

    return await db.inTransaction(async (tx) => {
      const current = await tx.player.balance.get({
        minecraftUuid: uuid,
      });
      // Compute the net delta so the transaction log records the signed change, not the new absolute value
      const difference = amountBigInt - current.balance;

      await tx.player.balance.update(
        {
          minecraftUuid: uuid,
        },
        { balance: amountBigInt },
      );

      await this.logTransaction({
        playerMinecraftUuid: uuid,
        amount: difference,
        balanceBefore: current.balance,
        balanceAfter: amountBigInt,
        transactionType: type,
        description: reason,
        metadata,
      });

      return BalanceUtils.fromStorage(amountBigInt);
    });
  }

  /**
   * Transfers balance between two players
   *
   * @param from - Sender identifier
   * @param to - Recipient identifier
   * @param amount - Amount to transfer
   * @param description - Optional transfer description
   * @returns Promise resolving to both new balances
   *
   * @example
   * const result = await balanceRepo.transfer(
   *   { minecraftUsername: "Steve" },
   *   { minecraftUsername: "Alex" },
   *   0.500,
   *   "Payment"
   * );
   */
  async transfer(
    from: PlayerIdentifier,
    to: PlayerIdentifier,
    amount: number,
    description?: string,
  ): Promise<{
    senderBalance: number;
    recipientBalance: number;
  }> {
    if (amount <= 0) {
      throw new Error("Transfer amount must be positive");
    }

    BalanceUtils.validate(amount);
    const senderUuid = await this.resolvePlayerUuid(from);
    const recipientUuid = await this.resolvePlayerUuid(to);
    const amountBigInt = BalanceUtils.toStorage(amount);

    if (senderUuid === recipientUuid) {
      throw new Error("Cannot transfer to self");
    }

    return await db.inTransaction(async (tx) => {
      const senderBalance = await tx.player.balance.get({
        minecraftUuid: senderUuid,
      });
      const recipientBalance = await tx.player.balance.get({
        minecraftUuid: recipientUuid,
      });

      if (senderBalance.balance < amountBigInt) {
        throw new Error(
          `Insufficient balance: has ${BalanceUtils.format(senderBalance.balance)}, needs ${BalanceUtils.format(amountBigInt)}`,
        );
      }

      logger.debug(
        `Transfer: sender balance=${senderBalance.balance} (${typeof senderBalance.balance}), amount=${amountBigInt} (${typeof amountBigInt})`,
      );
      const newSenderBalance = BalanceUtils.subtract(
        senderBalance.balance,
        amountBigInt,
      );
      const newRecipientBalance = BalanceUtils.add(
        recipientBalance.balance,
        amountBigInt,
      );

      await tx.player.balance.update(
        { minecraftUuid: senderUuid },
        { balance: newSenderBalance },
      );

      await tx.player.balance.update(
        { minecraftUuid: recipientUuid },
        { balance: newRecipientBalance },
      );

      await this.logTransaction({
        playerMinecraftUuid: senderUuid,
        amount: -amountBigInt,
        balanceBefore: senderBalance.balance,
        balanceAfter: newSenderBalance,
        transactionType: BalanceTransactionType.TRANSFER_SEND,
        description: description || `Transfer to ${recipientUuid}`,
        relatedPlayerUuid: recipientUuid,
      });

      await this.logTransaction({
        playerMinecraftUuid: recipientUuid,
        amount: amountBigInt,
        balanceBefore: recipientBalance.balance,
        balanceAfter: newRecipientBalance,
        transactionType: BalanceTransactionType.TRANSFER_RECEIVE,
        description: description || `Transfer from ${senderUuid}`,
        relatedPlayerUuid: senderUuid,
      });

      return {
        senderBalance: BalanceUtils.fromStorage(newSenderBalance),
        recipientBalance: BalanceUtils.fromStorage(newRecipientBalance),
      };
    });
  }

  // ============================================================================
  // ADMIN METHODS
  // ============================================================================

  /**
   * Admin grants balance to a player
   * Logs action to admin_log_action
   *
   * @param identifier - Player identifier
   * @param amount - Amount to grant
   * @param adminDiscordId - Admin performing the action
   * @param adminUsername - Admin Minecraft username
   * @param reason - Reason for grant
   * @returns Promise resolving to new balance
   */
  async adminGrant(
    identifier: PlayerIdentifier,
    amount: number,
    adminDiscordId: string,
    adminUsername: string,
    reason: string,
  ): Promise<number> {
    const uuid = await this.resolvePlayerUuid(identifier);
    const player = await db.player.get({ minecraftUuid: uuid });
    const oldBalance = await this.getRaw(uuid);

    const newBalance = await this.add(
      uuid,
      amount,
      reason,
      BalanceTransactionType.ADMIN_GRANT,
      {
        adminDiscordId,
        adminUsername,
      },
    );

    // Log to admin_log_action
    await db.admin.log.action.logAction({
      adminDiscordId,
      adminUsername,
      actionType: "balance_grant",
      targetPlayerUuid: uuid,
      targetPlayerName: player.minecraftUsername,
      tableName: "player_balance",
      fieldName: "balance",
      oldValue: BalanceUtils.format(oldBalance),
      newValue: BalanceUtils.format(BalanceUtils.toStorage(newBalance)),
      reason,
      metadata: {
        amount: BalanceUtils.format(BalanceUtils.toStorage(amount)),
      },
    });

    return newBalance;
  }

  /**
   * Admin deducts balance from a player
   * Logs action to admin_log_action
   *
   * @param identifier - Player identifier
   * @param amount - Amount to deduct
   * @param adminDiscordId - Admin performing the action
   * @param adminUsername - Admin Minecraft username
   * @param reason - Reason for deduction
   * @returns Promise resolving to new balance
   */
  async adminDeduct(
    identifier: PlayerIdentifier,
    amount: number,
    adminDiscordId: string,
    adminUsername: string,
    reason: string,
  ): Promise<number> {
    const uuid = await this.resolvePlayerUuid(identifier);
    const player = await db.player.get({ minecraftUuid: uuid });
    const oldBalance = await this.getRaw(uuid);

    const newBalance = await this.deduct(
      uuid,
      amount,
      reason,
      BalanceTransactionType.ADMIN_DEDUCT,
      {
        adminDiscordId,
        adminUsername,
      },
    );

    // Log to admin_log_action
    await db.admin.log.action.logAction({
      adminDiscordId,
      adminUsername,
      actionType: "balance_deduct",
      targetPlayerUuid: uuid,
      targetPlayerName: player.minecraftUsername,
      tableName: "player_balance",
      fieldName: "balance",
      oldValue: BalanceUtils.format(oldBalance),
      newValue: BalanceUtils.format(BalanceUtils.toStorage(newBalance)),
      reason,
      metadata: {
        amount: BalanceUtils.format(BalanceUtils.toStorage(amount)),
      },
    });

    return newBalance;
  }

  /**
   * Admin sets balance to exact amount
   * Logs action to admin_log_action
   *
   * @param identifier - Player identifier
   * @param amount - New balance amount
   * @param adminDiscordId - Admin performing the action
   * @param adminUsername - Admin Minecraft username
   * @param reason - Reason for setting balance
   * @returns Promise resolving to new balance
   */
  async adminSet(
    identifier: PlayerIdentifier,
    amount: number,
    adminDiscordId: string,
    adminUsername: string,
    reason: string,
  ): Promise<number> {
    const uuid = await this.resolvePlayerUuid(identifier);
    const player = await db.player.get({ minecraftUuid: uuid });
    const oldBalance = await this.getRaw(uuid);

    const newBalance = await this.set(
      uuid,
      amount,
      reason,
      BalanceTransactionType.ADMIN_GRANT,
      {
        adminDiscordId,
        adminUsername,
      },
    );

    // Log to admin_log_action
    await db.admin.log.action.logAction({
      adminDiscordId,
      adminUsername,
      actionType: "balance_set",
      targetPlayerUuid: uuid,
      targetPlayerName: player.minecraftUsername,
      tableName: "player_balance",
      fieldName: "balance",
      oldValue: BalanceUtils.format(oldBalance),
      newValue: BalanceUtils.format(BalanceUtils.toStorage(newBalance)),
      reason,
    });

    return newBalance;
  }

  // ============================================================================
  // TRANSACTION HISTORY
  // ============================================================================

  /**
   * Gets transaction history for a player
   *
   * @param identifier - Player identifier
   * @param limit - Maximum transactions to return (default: 50)
   * @returns Transactions ordered by most recent first
   */
  async getHistory(
    identifier: PlayerIdentifier,
    limit: number = 50,
    offset: number = 0,
  ): Promise<PlayerBalanceTransaction[]> {
    const uuid = await this.resolvePlayerUuid(identifier);

    return await db.player.balance.transaction.findAll(
      { playerMinecraftUuid: uuid },
      {
        limit,
        offset,
        orderBy:
          DatabaseTable.PLAYER_BALANCE_TRANSACTION.CAMEL_FIELDS.CREATED_AT,
        orderDirection: "desc",
      },
    );
  }

  /**
   * Gets formatted transaction history with human-readable balance amounts
   *
   * @param identifier - Player identifier
   * @param limit - Maximum transactions to return (default: 50)
   * @returns Transactions with comma-formatted amount strings
   */
  async getFormattedHistory(
    identifier: PlayerIdentifier,
    limit: number = 50,
    offset: number = 0,
  ): Promise<
    Array<{
      id: number;
      amount: string;
      balanceBefore: string;
      balanceAfter: string;
      transactionType: string;
      description: string | null;
      createdAt: Date;
      metadata: Record<string, unknown>;
    }>
  > {
    const history = await this.getHistory(identifier, limit, offset);

    return history.map((tx) => ({
      id: tx.id,
      amount: BalanceUtils.formatWithCommas(tx.amount),
      balanceBefore: BalanceUtils.formatWithCommas(tx.balanceBefore),
      balanceAfter: BalanceUtils.formatWithCommas(tx.balanceAfter),
      transactionType: tx.transactionType,
      description: tx.description,
      createdAt: tx.createdAt,
      metadata: tx.metadata ?? {},
    }));
  }
}
