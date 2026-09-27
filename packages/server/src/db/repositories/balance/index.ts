import { db, Q } from "@/db";
import { NotFoundError } from "@/db/utils";
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

export interface BalanceMutationOptions {
  /** Free-form context stored on the ledger row. */
  metadata?: Record<string, unknown>;
  /** Client-generated request key, persisted on the ledger row for reconciliation. */
  idempotencyKey?: string;
  /** Join an existing outer transaction instead of starting a new one. */
  tx?: DatabaseQueries;
}

type LockedOptions = Omit<BalanceMutationOptions, "tx">;

export enum BalanceTransactionType {
  TRANSFER_SEND = "transfer_send",
  TRANSFER_RECEIVE = "transfer_receive",
  DEPOSIT = "deposit",
  WITHDRAW = "withdraw",
  ADMIN_GRANT = "admin_grant",
  ADMIN_DEDUCT = "admin_deduct",
  ADMIN_SET = "admin_set",
  PURCHASE = "purchase",
  SALE = "sale",
  REWARD = "reward",
  REFUND = "refund",
  GALLERY_REWARD = "gallery_reward",
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

  private async lockBalance(
    tx: DatabaseQueries,
    minecraftUuid: string,
  ): Promise<bigint> {
    const balance = await tx.player.balance.getForUpdate(minecraftUuid);
    if (balance === null) {
      throw new NotFoundError("player_balance", { minecraftUuid });
    }
    return balance;
  }

  private async resolvePlayerUuid(
    identifier: PlayerIdentifier,
    tx?: DatabaseQueries,
  ): Promise<string> {
    if (typeof identifier === "string") return identifier;
    if ("minecraftUuid" in identifier && identifier.minecraftUuid) {
      return identifier.minecraftUuid;
    }
    const player = await (tx ?? db).player.get(identifier);
    return player.minecraftUuid;
  }

  private async resolvePlayer(identifier: PlayerIdentifier): Promise<Player> {
    if (typeof identifier === "string") {
      return db.player.get({ minecraftUuid: identifier });
    }
    if ("minecraftUuid" in identifier && identifier.minecraftUuid) {
      return db.player.get({ minecraftUuid: identifier.minecraftUuid });
    }
    return db.player.get(identifier);
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
      idempotencyKey?: string;
    },
    tx: DatabaseQueries,
  ): Promise<void> {
    await tx.player.balance.transaction.create({
      playerMinecraftUuid: data.playerMinecraftUuid,
      amount: data.amount,
      balanceBefore: data.balanceBefore,
      balanceAfter: data.balanceAfter,
      transactionType: data.transactionType,
      description: data.description,
      relatedPlayerUuid: data.relatedPlayerUuid,
      metadata: data.metadata || {},
      idempotencyKey: data.idempotencyKey,
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
   * also writes an ADMIN_GRANT transaction entry for the seed amount in the
   * same transaction as the row.
   */
  async create(
    playerMinecraftUuid: string,
    initialBalance: number = 0,
  ): Promise<PlayerBalance> {
    const balanceBigInt = BalanceUtils.toStorage(initialBalance);

    return await db.inTransaction(async (tx) => {
      const created = await tx.player.balance.createAndReturn({
        minecraftUuid: playerMinecraftUuid,
        balance: balanceBigInt,
      });

      if (initialBalance > 0) {
        await this.logTransaction(
          {
            playerMinecraftUuid,
            amount: balanceBigInt,
            balanceBefore: 0n,
            balanceAfter: balanceBigInt,
            transactionType: BalanceTransactionType.ADMIN_GRANT,
            description: "Initial balance",
          },
          tx,
        );
      }

      logger.info(
        `Created balance for ${playerMinecraftUuid} with $${BalanceUtils.format(balanceBigInt)}`,
      );

      return created;
    });
  }

  private async addLocked(
    tx: DatabaseQueries,
    uuid: string,
    amount: number,
    reason: string,
    type: BalanceTransactionType,
    options: LockedOptions,
  ): Promise<{ before: bigint; after: bigint }> {
    if (amount <= 0) {
      throw new Error("Amount must be positive");
    }

    const amountBigInt = BalanceUtils.toStorage(amount);
    const balance = await this.lockBalance(tx, uuid);

    if (BalanceUtils.wouldOverflow(balance, amount)) {
      throw new Error(`Cannot add ${amount}: would exceed maximum balance`);
    }

    const newBalance = BalanceUtils.add(balance, amountBigInt);

    await tx.player.balance.update(
      { minecraftUuid: uuid },
      { balance: newBalance },
    );

    await this.logTransaction(
      {
        playerMinecraftUuid: uuid,
        amount: amountBigInt,
        balanceBefore: balance,
        balanceAfter: newBalance,
        transactionType: type,
        description: reason,
        metadata: options.metadata,
        idempotencyKey: options.idempotencyKey,
      },
      tx,
    );

    return { before: balance, after: newBalance };
  }

  private async deductLocked(
    tx: DatabaseQueries,
    uuid: string,
    amount: number,
    reason: string,
    type: BalanceTransactionType,
    options: LockedOptions,
  ): Promise<{ before: bigint; after: bigint }> {
    if (amount <= 0) {
      throw new Error("Amount must be positive");
    }

    const amountBigInt = BalanceUtils.toStorage(amount);
    const balance = await this.lockBalance(tx, uuid);

    if (balance < amountBigInt) {
      throw new Error(
        `Insufficient balance: has ${BalanceUtils.format(balance)}, needs ${BalanceUtils.format(amountBigInt)}`,
      );
    }

    const newBalance = BalanceUtils.subtract(balance, amountBigInt);

    await tx.player.balance.update(
      { minecraftUuid: uuid },
      { balance: newBalance },
    );

    await this.logTransaction(
      {
        playerMinecraftUuid: uuid,
        amount: -amountBigInt,
        balanceBefore: balance,
        balanceAfter: newBalance,
        transactionType: type,
        description: reason,
        metadata: options.metadata,
        idempotencyKey: options.idempotencyKey,
      },
      tx,
    );

    return { before: balance, after: newBalance };
  }

  private async setLocked(
    tx: DatabaseQueries,
    uuid: string,
    amount: number,
    reason: string,
    type: BalanceTransactionType,
    options: LockedOptions,
  ): Promise<{ before: bigint; after: bigint }> {
    if (amount < 0) {
      throw new Error("Balance cannot be negative");
    }

    const amountBigInt = BalanceUtils.toStorage(amount);
    const balance = await this.lockBalance(tx, uuid);
    const difference = amountBigInt - balance;

    await tx.player.balance.update(
      { minecraftUuid: uuid },
      { balance: amountBigInt },
    );

    await this.logTransaction(
      {
        playerMinecraftUuid: uuid,
        amount: difference,
        balanceBefore: balance,
        balanceAfter: amountBigInt,
        transactionType: type,
        description: reason,
        metadata: options.metadata,
      },
      tx,
    );

    return { before: balance, after: amountBigInt };
  }

  /**
   * Add to a player's balance. The balance row is read under a row lock and
   * the overflow check, update, and ledger insert all commit together; pass
   * options.tx to join an existing outer transaction. Resolves to the new
   * balance as a decimal.
   */
  async add(
    identifier: PlayerIdentifier,
    amount: number,
    reason: string,
    type: BalanceTransactionType,
    options: BalanceMutationOptions = {},
  ): Promise<number> {
    const uuid = await this.resolvePlayerUuid(identifier, options.tx);

    return await (options.tx ?? db).inTransaction(async (tx) => {
      const { after } = await this.addLocked(tx, uuid, amount, reason, type, {
        metadata: options.metadata,
        idempotencyKey: options.idempotencyKey,
      });
      return BalanceUtils.fromStorage(after);
    });
  }

  /**
   * Deduct from a player's balance. The balance row is read under a row lock
   * and the funds check, update, and ledger insert all commit together, so
   * concurrent debits are serialized and "Insufficient balance" always
   * reflects the locked value. Pass options.tx to join an existing outer
   * transaction. Resolves to the new balance as a decimal.
   */
  async deduct(
    identifier: PlayerIdentifier,
    amount: number,
    reason: string,
    type: BalanceTransactionType,
    options: BalanceMutationOptions = {},
  ): Promise<number> {
    const uuid = await this.resolvePlayerUuid(identifier, options.tx);

    return await (options.tx ?? db).inTransaction(async (tx) => {
      const { after } = await this.deductLocked(
        tx,
        uuid,
        amount,
        reason,
        type,
        { metadata: options.metadata, idempotencyKey: options.idempotencyKey },
      );
      return BalanceUtils.fromStorage(after);
    });
  }

  /**
   * Set a player's balance to an absolute amount. The transaction log records
   * the signed delta from the previous balance, not the new absolute value.
   * Pass options.tx to join an existing outer transaction.
   */
  async set(
    identifier: PlayerIdentifier,
    amount: number,
    reason: string,
    type: BalanceTransactionType,
    options: Omit<BalanceMutationOptions, "idempotencyKey"> = {},
  ): Promise<number> {
    const uuid = await this.resolvePlayerUuid(identifier, options.tx);

    return await (options.tx ?? db).inTransaction(async (tx) => {
      const { after } = await this.setLocked(tx, uuid, amount, reason, type, {
        metadata: options.metadata,
      });
      return BalanceUtils.fromStorage(after);
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

    const senderUuid = await this.resolvePlayerUuid(from);
    const recipientUuid = await this.resolvePlayerUuid(to);
    const amountBigInt = BalanceUtils.toStorage(amount);

    if (senderUuid === recipientUuid) {
      throw new Error("Cannot transfer to self");
    }

    return await db.inTransaction(async (tx) => {
      const senderFirst = senderUuid < recipientUuid;
      const firstBalance = await this.lockBalance(
        tx,
        senderFirst ? senderUuid : recipientUuid,
      );
      const secondBalance = await this.lockBalance(
        tx,
        senderFirst ? recipientUuid : senderUuid,
      );
      const [senderBalance, recipientBalance] = senderFirst
        ? [firstBalance, secondBalance]
        : [secondBalance, firstBalance];

      if (senderBalance < amountBigInt) {
        throw new Error(
          `Insufficient balance: has ${BalanceUtils.format(senderBalance)}, needs ${BalanceUtils.format(amountBigInt)}`,
        );
      }

      const newSenderBalance = BalanceUtils.subtract(
        senderBalance,
        amountBigInt,
      );
      const newRecipientBalance = BalanceUtils.add(
        recipientBalance,
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

      await this.logTransaction(
        {
          playerMinecraftUuid: senderUuid,
          amount: -amountBigInt,
          balanceBefore: senderBalance,
          balanceAfter: newSenderBalance,
          transactionType: BalanceTransactionType.TRANSFER_SEND,
          description: description || `Transfer to ${recipientUuid}`,
          relatedPlayerUuid: recipientUuid,
        },
        tx,
      );

      await this.logTransaction(
        {
          playerMinecraftUuid: recipientUuid,
          amount: amountBigInt,
          balanceBefore: recipientBalance,
          balanceAfter: newRecipientBalance,
          transactionType: BalanceTransactionType.TRANSFER_RECEIVE,
          description: description || `Transfer from ${senderUuid}`,
          relatedPlayerUuid: senderUuid,
        },
        tx,
      );

      return {
        senderBalance: BalanceUtils.fromStorage(newSenderBalance),
        recipientBalance: BalanceUtils.fromStorage(newRecipientBalance),
      };
    });
  }

  private async logAdminAction(
    input: {
      actionType: "balance_grant" | "balance_deduct" | "balance_set";
      player: Player;
      adminDiscordId: string;
      adminUsername: string;
      reason: string;
      before: bigint;
      after: bigint;
      metadata?: Record<string, unknown>;
    },
    tx: DatabaseQueries,
  ): Promise<void> {
    await tx.admin.log.action.logAction({
      adminDiscordId: input.adminDiscordId,
      adminUsername: input.adminUsername,
      actionType: input.actionType,
      targetPlayerUuid: input.player.minecraftUuid,
      targetPlayerName: input.player.minecraftUsername,
      tableName: "player_balance",
      fieldName: "balance",
      oldValue: BalanceUtils.format(input.before),
      newValue: BalanceUtils.format(input.after),
      reason: input.reason,
      metadata: input.metadata,
    });
  }

  /**
   * Admin grant variant of add(). The balance change, its ledger row, and the
   * admin_log_action entry commit in one transaction, with the audit's old
   * value taken from the locked read rather than a separate query.
   */
  async adminGrant(
    identifier: PlayerIdentifier,
    amount: number,
    adminDiscordId: string,
    adminUsername: string,
    reason: string,
  ): Promise<number> {
    const player = await this.resolvePlayer(identifier);

    return await db.inTransaction(async (tx) => {
      const { before, after } = await this.addLocked(
        tx,
        player.minecraftUuid,
        amount,
        reason,
        BalanceTransactionType.ADMIN_GRANT,
        { metadata: { adminDiscordId, adminUsername } },
      );
      await this.logAdminAction(
        {
          actionType: "balance_grant",
          player,
          adminDiscordId,
          adminUsername,
          reason,
          before,
          after,
          metadata: {
            amount: BalanceUtils.format(BalanceUtils.toStorage(amount)),
          },
        },
        tx,
      );
      return BalanceUtils.fromStorage(after);
    });
  }

  /**
   * Admin deduction variant of deduct(). The balance change, its ledger row,
   * and the admin_log_action entry commit in one transaction, with the
   * audit's old value taken from the locked read.
   */
  async adminDeduct(
    identifier: PlayerIdentifier,
    amount: number,
    adminDiscordId: string,
    adminUsername: string,
    reason: string,
  ): Promise<number> {
    const player = await this.resolvePlayer(identifier);

    return await db.inTransaction(async (tx) => {
      const { before, after } = await this.deductLocked(
        tx,
        player.minecraftUuid,
        amount,
        reason,
        BalanceTransactionType.ADMIN_DEDUCT,
        { metadata: { adminDiscordId, adminUsername } },
      );
      await this.logAdminAction(
        {
          actionType: "balance_deduct",
          player,
          adminDiscordId,
          adminUsername,
          reason,
          before,
          after,
          metadata: {
            amount: BalanceUtils.format(BalanceUtils.toStorage(amount)),
          },
        },
        tx,
      );
      return BalanceUtils.fromStorage(after);
    });
  }

  /**
   * Admin set variant of set(). Records an ADMIN_SET ledger row whose amount
   * is the signed delta, and commits it with the admin_log_action entry in one
   * transaction.
   */
  async adminSet(
    identifier: PlayerIdentifier,
    amount: number,
    adminDiscordId: string,
    adminUsername: string,
    reason: string,
  ): Promise<number> {
    const player = await this.resolvePlayer(identifier);

    return await db.inTransaction(async (tx) => {
      const { before, after } = await this.setLocked(
        tx,
        player.minecraftUuid,
        amount,
        reason,
        BalanceTransactionType.ADMIN_SET,
        { metadata: { adminDiscordId, adminUsername } },
      );
      await this.logAdminAction(
        {
          actionType: "balance_set",
          player,
          adminDiscordId,
          adminUsername,
          reason,
          before,
          after,
        },
        tx,
      );
      return BalanceUtils.fromStorage(after);
    });
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
        // Order by the serial id, not created_at: it is the insertion order and
        // is unique, so rows written in the same tick still sort deterministically.
        orderBy: DatabaseTable.PLAYER_BALANCE_TRANSACTION.CAMEL_FIELDS.ID,
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
