import { Q, R } from "@/db";
import { BalanceTransactionType } from "@/db/repositories/balance";
import { calculateFee } from "./fee-calculator";
import type { CryptoToken } from "@createrington/shared/db/crypto_token.types";
import { CRYPTO_CONFIG } from "../crypto.config";

export interface TradeResult {
  transactionId: number;
  tokenId: number;
  symbol: string;
  type: "buy" | "sell";
  amount: bigint;
  priceAtExecution: string;
  feeAmount: number;
  totalCost: number;
}

interface TradeRateLimiter {
  counts: Map<string, { count: number; resetAt: number }>;
}

const rateLimiter: TradeRateLimiter = { counts: new Map() };

function checkRateLimit(playerUuid: string): void {
  const now = Date.now();
  const entry = rateLimiter.counts.get(playerUuid);

  if (!entry || now > entry.resetAt) {
    rateLimiter.counts.set(playerUuid, {
      count: 1,
      resetAt: now + 60_000,
    });
    return;
  }

  if (entry.count >= CRYPTO_CONFIG.MAX_TRADES_PER_MINUTE) {
    throw new Error(
      `Rate limit exceeded: max ${CRYPTO_CONFIG.MAX_TRADES_PER_MINUTE} trades per minute`,
    );
  }

  entry.count++;
}

async function getLifetimeTradeCount(playerUuid: string): Promise<number> {
  const result = await Q.crypto.transaction
    .where({ playerMinecraftUuid: playerUuid })
    .count();
  return result;
}

export async function executeBuy(
  playerUuid: string,
  token: CryptoToken,
  amount: bigint,
): Promise<TradeResult> {
  if (token.isCrashed) {
    throw new Error(`Token ${token.symbol} has crashed and cannot be purchased`);
  }

  if (token.delistedAt) {
    throw new Error(`Token ${token.symbol} has been delisted`);
  }

  if (amount <= 0n) {
    throw new Error("Amount must be positive");
  }

  if (amount > token.availableSupply) {
    throw new Error(
      `Insufficient supply: only ${token.availableSupply} ${token.symbol} available`,
    );
  }

  checkRateLimit(playerUuid);

  const price = Number(token.price);
  const amountNum = Number(amount);
  const rawCost = price * amountNum;
  const lifetimeCount = await getLifetimeTradeCount(playerUuid);
  const feeAmount = calculateFee(rawCost, token.category, lifetimeCount);
  const totalCost = rawCost + feeAmount;

  // Deduct player balance
  await R.balanceRepo.deduct(
    { minecraftUuid: playerUuid },
    totalCost,
    `Crypto buy: ${amountNum} ${token.symbol} @ $${price}`,
    BalanceTransactionType.CRYPTO_BUY,
    {
      tokenId: token.id,
      tokenSymbol: token.symbol,
      amount: amountNum,
      price,
      fee: feeAmount,
    },
  );

  // Update token supply
  await Q.crypto.token.update(
    { id: token.id },
    { availableSupply: token.availableSupply - amount },
  );

  // Upsert holding
  const existingHolding = await Q.crypto.holding
    .where({
      playerMinecraftUuid: playerUuid,
      tokenId: token.id,
    })
    .first();

  if (existingHolding) {
    await Q.crypto.holding.update(
      { id: existingHolding.id },
      {
        amount: existingHolding.amount + amount,
        totalCostBasis: (
          Number(existingHolding.totalCostBasis) + rawCost
        ).toFixed(8),
        updatedAt: new Date(),
      },
    );
  } else {
    await Q.crypto.holding.create({
      playerMinecraftUuid: playerUuid,
      tokenId: token.id,
      amount,
      totalCostBasis: rawCost.toFixed(8),
    });
  }

  // Record transaction
  const txResult = await Q.crypto.transaction.createAndReturn({
    playerMinecraftUuid: playerUuid,
    tokenId: token.id,
    type: "buy",
    trigger: "market",
    amount,
    priceAtExecution: token.price,
    feeAmount: feeAmount.toFixed(8),
    totalCost: totalCost.toFixed(8),
  });

  // Update treasury with collected fee
  if (feeAmount > 0) {
    await updateTreasury(feeAmount, token.category);
  }

  return {
    transactionId: txResult.id,
    tokenId: token.id,
    symbol: token.symbol,
    type: "buy",
    amount,
    priceAtExecution: token.price,
    feeAmount,
    totalCost,
  };
}

export async function executeSell(
  playerUuid: string,
  token: CryptoToken,
  amount: bigint,
): Promise<TradeResult> {
  if (amount <= 0n) {
    throw new Error("Amount must be positive");
  }

  checkRateLimit(playerUuid);

  // Check holdings
  const holding = await Q.crypto.holding
    .where({
      playerMinecraftUuid: playerUuid,
      tokenId: token.id,
    })
    .first();

  if (!holding || holding.amount < amount) {
    throw new Error(
      `Insufficient holdings: you have ${holding?.amount ?? 0n} ${token.symbol}`,
    );
  }

  const price = Number(token.price);
  const amountNum = Number(amount);
  const rawRevenue = price * amountNum;
  const lifetimeCount = await getLifetimeTradeCount(playerUuid);
  const feeAmount = calculateFee(rawRevenue, token.category, lifetimeCount);
  const netRevenue = rawRevenue - feeAmount;

  // Add player balance
  await R.balanceRepo.add(
    { minecraftUuid: playerUuid },
    netRevenue,
    `Crypto sell: ${amountNum} ${token.symbol} @ $${price}`,
    BalanceTransactionType.CRYPTO_SELL,
    {
      tokenId: token.id,
      tokenSymbol: token.symbol,
      amount: amountNum,
      price,
      fee: feeAmount,
    },
  );

  // Update token supply
  await Q.crypto.token.update(
    { id: token.id },
    { availableSupply: token.availableSupply + amount },
  );

  // Update holding
  const newAmount = holding.amount - amount;
  if (newAmount === 0n) {
    await Q.crypto.holding.delete({ id: holding.id });
  } else {
    // Proportionally reduce cost basis
    const proportion = Number(amount) / Number(holding.amount);
    const costBasisReduction =
      Number(holding.totalCostBasis) * proportion;
    await Q.crypto.holding.update(
      { id: holding.id },
      {
        amount: newAmount,
        totalCostBasis: (
          Number(holding.totalCostBasis) - costBasisReduction
        ).toFixed(8),
        updatedAt: new Date(),
      },
    );
  }

  // Calculate realized P&L
  const costBasisPortion =
    (Number(holding.totalCostBasis) / Number(holding.amount)) * amountNum;
  const realizedPnl = rawRevenue - costBasisPortion;

  // Record transaction
  const txResult = await Q.crypto.transaction.createAndReturn({
    playerMinecraftUuid: playerUuid,
    tokenId: token.id,
    type: "sell",
    trigger: "market",
    amount,
    priceAtExecution: token.price,
    feeAmount: feeAmount.toFixed(8),
    totalCost: netRevenue.toFixed(8),
    realizedPnl: realizedPnl.toFixed(8),
  });

  // Update treasury with collected fee
  if (feeAmount > 0) {
    await updateTreasury(feeAmount, token.category);
  }

  return {
    transactionId: txResult.id,
    tokenId: token.id,
    symbol: token.symbol,
    type: "sell",
    amount,
    priceAtExecution: token.price,
    feeAmount,
    totalCost: netRevenue,
  };
}

async function updateTreasury(
  feeAmount: number,
  category: string,
): Promise<void> {
  const burnAmount =
    category === "memecoin"
      ? feeAmount * CRYPTO_CONFIG.FEES.BURN_RATIO
      : 0;
  const collectedAmount = feeAmount - burnAmount;

  // Get or create treasury row
  const treasury = await Q.crypto.treasury.where({}).first();
  if (treasury) {
    await Q.crypto.treasury.update(
      { id: treasury.id },
      {
        totalCollected: (
          Number(treasury.totalCollected) + collectedAmount
        ).toFixed(8),
        totalBurned: (
          Number(treasury.totalBurned) + burnAmount
        ).toFixed(8),
        updatedAt: new Date(),
      },
    );
  } else {
    await Q.crypto.treasury.create({
      totalCollected: collectedAmount.toFixed(8),
      totalBurned: burnAmount.toFixed(8),
    });
  }
}
