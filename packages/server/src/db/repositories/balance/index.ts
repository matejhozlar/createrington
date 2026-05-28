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
 * Manages player currency balances and their full audit trail. Reads,
 * mutates, and transfers balances inside atomic DB transactions, logs every
 * change to the transaction history table, and exposes admin-flavored
 * operations that also write to the admin audit log. Balances are stored as
 * bigint with 3 implicit decimal places (1500n represents $1.500); use
 * BalanceUtils for all conversions.
 */
export class BalanceRepository {
  constructor() {}

  // Acquires a row-level lock on a player_balance row so the surrounding
  // read-modify-write sequence is serialized against concurrent mutators.
  // Without this, two parallel add/deduct/transfer calls under READ COMMITTED
  // can both read the same balance and one update is lost.
  private async lockBalance(
    tx: DatabaseQueries,
    minecraftUuid: string,
  ): Promise<void> {
    const client = tx.getDb();
    await client.query(
      "SELECT 1 FROM player_balance WHERE minecraft_uuid = $1 FOR UPDATE",
      [minecraftUuid],
    );
  }

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

  /** Get the full balance entity (raw bigint balance plus metadata). */
  async get(identifier: PlayerIdentifier): Promise<PlayerBalance> {
    const uuid = await this.resolvePlayerUuid(identifier);
    return await db.player.balance.get({ minecraftUuid: uuid });
  }

  /** Get the balance as a decimal number (e.g. 1.5). */
  async getAmount(identifier: PlayerIdentifier): Promise<number> {
    const uuid = await this.resolvePlayerUuid(identifier);
    const balanceBigInt = await db.player.balance.select.balance({
      minecraftUuid: uuid,
    });
    return BalanceUtils.fromStorage(balanceBigInt);
  }

  /** Get the raw storage bigint (e.g. 1500n for $1.500), not user-facing. */
  async getRaw(identifier: PlayerIdentifier): Promise<bigint> {
    const uuid = await this.resolvePlayerUuid(identifier);
    return await db.player.balance.select.balance({
      minecraftUuid: uuid,
    });
  }

  /** Returns true if the player's balance is at least the given decimal amount. */
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

  /** Top N players by balance, sorted balance DESC. */
  async getTop(
    limit: number = 10,
  ): Promise<Array<{ name: string; balance: number }>> {
    return Q.player.balance.getTop(limit);
  }

  /**
   * Create the initial balance row for a new player. If initialBalance > 0,
   * also writes an ADMIN_GRANT transaction entry for the seed amount.
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

  /**
   * Add to a player's balance inside a row-locked transaction. Pass txOverride
   * to join an existing outer transaction instead of starting a new one.
   * Resolves to the new balance as a decimal.
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
      await this.lockBalance(tx, uuid);
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
   * Deduct from a player's balance inside a row-locked transaction. Throws if
   * the player has insufficient funds. Pass txOverride to join an existing
   * outer transaction. Resolves to the new balance as a decimal.
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
      await this.lockBalance(tx, uuid);
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
   * Set a player's balance to an absolute amount. The transaction log records
   * the signed delta from the previous balance, not the new absolute value.
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
      await this.lockBalance(tx, uuid);
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
   * Atomic two-party transfer. Locks both balance rows in lexicographic UUID
   * order so concurrent reverse transfers cannot deadlock, then writes paired
   * TRANSFER_SEND / TRANSFER_RECEIVE log entries.
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
      // Lock both rows in lexicographic UUID order so two concurrent
      // transfer(A->B) and transfer(B->A) calls can't deadlock.
      const [firstLock, secondLock] = [senderUuid, recipientUuid].sort();
      await this.lockBalance(tx, firstLock);
      await this.lockBalance(tx, secondLock);

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

  /** Admin grant variant of add() that also writes to admin_log_action. */
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

  /** Admin deduction variant of deduct() that also writes to admin_log_action. */
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

  /** Admin set variant of set() that also writes to admin_log_action. */
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

  /** Raw transaction history for a player, ordered most recent first. */
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

  /** Transaction history with amounts pre-formatted as comma-grouped strings. */
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
