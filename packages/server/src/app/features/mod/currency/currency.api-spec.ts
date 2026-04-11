import { defineApiSpec } from "@/scripts/api/spec-types";

export default defineApiSpec({
  name: "Currency",
  prefix: "/api/currency",
  description:
    "In-game economy operations: balance, payments, deposits, withdrawals, daily rewards, leaderboard, lottery",
  auth: "Server IP + Mod JWT",
  mod: true,
  endpoints: [
    {
      method: "POST",
      path: "/login",
      name: "Login",
      description:
        "Creates a short-lived JWT (10 min) for subsequent currency requests. Only requires server IP verification.",
      auth: "Server IP",
      request: {
        name: "LoginRequest",
        fields: [
          {
            name: "uuid",
            type: "string",
            description: "Minecraft player UUID",
          },
          { name: "name", type: "string", description: "Minecraft username" },
        ],
      },
      response: {
        name: "LoginResponse",
        fields: [
          {
            name: "token",
            type: "string",
            description: "HS256 JWT, expires in 10 minutes",
          },
        ],
      },
    },
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
      description: "Transfers currency between two players.",
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
          {
            name: "fromUuid",
            type: "string",
            nullable: true,
            description: "Sender UUID; defaults to authenticated player",
          },
        ],
      },
      response: {
        name: "PayResponse",
        fields: [
          { name: "success", type: "boolean" },
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
      description: "Adds currency to the authenticated player's balance.",
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
        ],
      },
      response: {
        name: "DepositResponse",
        fields: [
          { name: "success", type: "boolean" },
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
        "Withdraws currency from the authenticated player's balance. Total withdrawn = denomination * count.",
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
        ],
      },
      response: {
        name: "WithdrawResponse",
        fields: [
          { name: "success", type: "boolean" },
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
        "Claims the daily reward for the authenticated player. Returns 400 with a message if not yet eligible.",
      response: {
        name: "DailyResponse",
        fields: [{ name: "message", type: "string" }],
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
          { name: "success", type: "boolean" },
          { name: "message", type: "string" },
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
          { name: "success", type: "boolean" },
          { name: "message", type: "string" },
          { name: "entryAmount", type: "double" },
          { name: "totalPot", type: "double" },
          { name: "participantCount", type: "int" },
        ],
      },
    },
  ],
});
