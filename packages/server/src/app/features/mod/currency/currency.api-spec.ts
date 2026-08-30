import { defineApiSpec } from "@/scripts/api/spec-types";

export default defineApiSpec({
  name: "Currency",
  prefix: "/api/currency",
  description:
    "In-game economy operations: balance, payments, deposits, withdrawals, daily rewards, leaderboard, lottery",
  auth: "Server IP + Mod JWT",
  mod: true,
  enveloped: true,
  endpoints: [
    {
      method: "GET",
      path: "/balance",
      name: "Balance",
      description: "Returns the authenticated player's current balance.",
      response: {
        name: "BalanceResponse",
        fields: [
          { name: "balance", type: "double", description: "Current balance" },
        ],
      },
    },
    {
      method: "POST",
      path: "/pay",
      name: "Pay",
      description:
        "Transfers currency from the authenticated player to the recipient.",
      request: {
        name: "PayRequest",
        fields: [
          {
            name: "toUuid",
            type: "string",
            description: "Recipient's Minecraft UUID",
          },
          {
            name: "amount",
            type: "double",
            description: "Positive amount to transfer",
          },
        ],
      },
      response: {
        name: "PayResponse",
        fields: [
          {
            name: "newSenderBalance",
            type: "double",
            jsonName: "new_sender_balance",
            description: "Sender's new balance",
          },
        ],
      },
    },
    {
      method: "POST",
      path: "/deposit",
      name: "Deposit",
      description:
        "Adds currency to the authenticated player's balance. Send an idempotencyKey to make the request safe to retry after a timeout: a replay with the same key and body returns the stored response without crediting again, a replay with the same key and a different body is rejected with 409. The replayed response is the original one, so its new_balance is the balance right after the original attempt, not the current balance. Keys are retained for 24 hours.",
      request: {
        name: "DepositRequest",
        fields: [
          {
            name: "amount",
            type: "double",
            description: "Positive amount to add",
          },
          {
            name: "reason",
            type: "string",
            nullable: true,
            description: "Transaction description; defaults to 'Deposit'",
          },
          {
            name: "idempotencyKey",
            type: "string",
            nullable: true,
            description:
              "Client-generated key unique per attempt (e.g. a random UUID): 1 to 128 characters of letters, digits, '.', '_', ':' or '-'. Reuse it on retries of the same request.",
          },
        ],
      },
      response: {
        name: "DepositResponse",
        fields: [
          {
            name: "newBalance",
            type: "double",
            jsonName: "new_balance",
            description: "New balance after deposit",
          },
        ],
      },
    },
    {
      method: "POST",
      path: "/withdraw",
      name: "Withdraw",
      description:
        "Withdraws currency from the authenticated player's balance. Total withdrawn = denomination * count. The funds check and debit are one atomic step, so concurrent withdrawals can never overdraw. Send an idempotencyKey to make the request safe to retry after a timeout: a replay with the same key and body returns the stored response without debiting again, a replay with the same key and a different body is rejected with 409. The replayed response is the original one, so its new_balance is the balance right after the original attempt, not the current balance. Keys are retained for 24 hours.",
      request: {
        name: "WithdrawRequest",
        fields: [
          {
            name: "denomination",
            type: "double",
            description: "Unit size of one note/coin",
          },
          {
            name: "count",
            type: "int",
            description: "Number of units to withdraw",
          },
          {
            name: "idempotencyKey",
            type: "string",
            nullable: true,
            description:
              "Client-generated key unique per attempt (e.g. a random UUID): 1 to 128 characters of letters, digits, '.', '_', ':' or '-'. Reuse it on retries of the same request.",
          },
        ],
      },
      response: {
        name: "WithdrawResponse",
        fields: [
          {
            name: "withdrawn",
            type: "double",
            description: "Total amount deducted (denomination * count)",
          },
          {
            name: "newBalance",
            type: "double",
            jsonName: "new_balance",
            description: "New balance after withdrawal",
          },
          { name: "denomination", type: "double" },
          { name: "count", type: "int" },
        ],
      },
    },
    {
      method: "GET",
      path: "/top",
      name: "Top",
      description: "Returns top 10 players by balance, sorted descending.",
      response: {
        name: "TopEntry",
        isArray: true,
        fields: [
          { name: "name", type: "string", description: "Minecraft username" },
          { name: "balance", type: "double" },
        ],
      },
    },
    {
      method: "POST",
      path: "/daily",
      name: "Daily",
      description:
        "Claims the daily reward for the authenticated player. Returns 400 (with playerMessage on the envelope) when the player is still on cooldown.",
      response: {
        name: "DailyResponse",
        fields: [
          {
            name: "amount",
            type: "double",
            nullable: true,
            description: "Reward amount granted",
          },
        ],
      },
    },
    {
      method: "GET",
      path: "/history",
      name: "History",
      description:
        "Returns paginated transaction history for the authenticated player.",
      query: [
        {
          name: "page",
          type: "int",
          nullable: true,
          description: "1-indexed page number (default: 1)",
        },
        {
          name: "limit",
          type: "int",
          nullable: true,
          description: "Items per page (default: 10, max: 20)",
        },
      ],
      response: {
        name: "HistoryResponse",
        fields: [
          {
            name: "transactions",
            type: {
              type: "array",
              items: {
                type: "object",
                name: "Transaction",
                fields: [
                  { name: "id", type: "int" },
                  {
                    name: "amount",
                    type: "string",
                    description:
                      "Comma-formatted with 3 decimal places, signed",
                  },
                  {
                    name: "balanceBefore",
                    type: "string",
                    description: "Comma-formatted",
                  },
                  {
                    name: "balanceAfter",
                    type: "string",
                    description: "Comma-formatted",
                  },
                  {
                    name: "transactionType",
                    type: "string",
                    description: "Transaction type enum value",
                  },
                  { name: "description", type: "string", nullable: true },
                  {
                    name: "createdAt",
                    type: "string",
                    description: "ISO 8601 UTC string",
                  },
                ],
              },
            },
          },
          { name: "page", type: "int" },
          { name: "hasMore", type: "boolean" },
        ],
      },
    },
    {
      method: "POST",
      path: "/lottery/start",
      name: "LotteryStart",
      description: "Starts a new lottery round with the given buy-in amount.",
      request: {
        name: "LotteryStartRequest",
        fields: [
          { name: "amount", type: "double", description: "Buy-in amount" },
        ],
      },
      response: {
        name: "LotteryStartResponse",
        fields: [
          { name: "entryAmount", type: "double" },
          {
            name: "endsAt",
            type: "string",
            description: "ISO 8601 timestamp when the lottery resolves",
          },
        ],
      },
    },
    {
      method: "POST",
      path: "/lottery/join",
      name: "LotteryJoin",
      description: "Joins an active lottery round with the given bet amount.",
      request: {
        name: "LotteryJoinRequest",
        fields: [{ name: "amount", type: "double", description: "Bet amount" }],
      },
      response: {
        name: "LotteryJoinResponse",
        fields: [
          { name: "entryAmount", type: "double" },
          { name: "totalPot", type: "double" },
          { name: "participantCount", type: "int" },
        ],
      },
    },
  ],
});
