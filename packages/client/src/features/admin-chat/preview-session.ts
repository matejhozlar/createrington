// TEMP: local design preview of the chat layouts, strip before PR
import { useCallback, useEffect, useRef, useState } from "react";
import type { AdminChatModel, ChatMessage } from "./types";

const PREVIEW_MESSAGES: ChatMessage[] = [
  {
    id: 1,
    role: "user",
    content: "Find a player by Minecraft username saunhardy",
    createdAt: "2026-08-30T09:12:04.000Z",
  },
  {
    id: 2,
    role: "assistant",
    content:
      "Found one match in `player`:\n\n- **Username:** saunhardy\n- **Discord:** `saunhardy#0001`\n- **Role:** admin\n- **Balance:** 12,480 coins\n- **Playtime (season 3):** 41h 12m\n\nYou can open the full profile at [/admin/players](/admin/players) and search for the same name, the row actions there cover bans and balance adjustments.",
    createdAt: "2026-08-30T09:12:09.000Z",
  },
  {
    id: 3,
    role: "user",
    content: "Summarize recent bans this week",
    createdAt: "2026-08-30T09:13:31.000Z",
  },
  {
    id: 4,
    role: "assistant",
    content:
      "Three bans were issued since Monday:\n\n| Player | Reason | Issued by | Expires |\n| --- | --- | --- | --- |\n| creeper_lord | Griefing spawn | saunhardy | permanent |\n| xX_redstone_Xx | Duplication exploit | matej | 2026-09-06 |\n| pixel_pete | Chat spam | saunhardy | 2026-09-02 |\n\nTwo of them came from the same IP range, worth a look before the next appeal comes in.",
    createdAt: "2026-08-30T09:13:38.000Z",
  },
  {
    id: 5,
    role: "user",
    content: "Explain how playtime tracking works",
    createdAt: "2026-08-30T09:15:02.000Z",
  },
  {
    id: 6,
    role: "assistant",
    content:
      "Playtime is aggregated in application code, there are no database triggers involved.\n\n1. The presence endpoint receives join and leave events from the mod.\n2. `PlaytimeManagerService` keeps an in-memory map of online players and their session start.\n3. Every minute it flushes elapsed time into `player_playtime` per server.\n4. The leaderboard service reads those rows and caches the ranking.\n\nThe relevant flush looks like this:\n\n```ts\nfor (const [uuid, since] of this.online) {\n  const elapsed = Date.now() - since;\n  await R.playtimeRepo.add({ minecraftUuid: uuid, serverId, ms: elapsed });\n  this.online.set(uuid, Date.now());\n}\n```\n\nIf a server crashes between flushes, at most one minute of playtime is lost, which is the accepted trade-off.",
    createdAt: "2026-08-30T09:15:14.000Z",
  },
];

const PREVIEW_MODEL: AdminChatModel = "claude-sonnet-4-6";

function previewReply(prompt: string): string {
  return `Got it. Here is a mocked reply to **"${prompt}"** so the layout can be checked locally.\n\n- Nothing was sent to the real assistant\n- Messages reset on reload`;
}

export function usePreviewSession() {
  const [messages, setMessages] = useState<ChatMessage[]>(PREVIEW_MESSAGES);
  const [sessionActive, setSessionActive] = useState(true);
  const [awaitingReply, setAwaitingReply] = useState(false);
  const nextId = useRef(100);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const send = useCallback(async (message: string): Promise<void> => {
    const trimmed = message.trim();
    if (!trimmed) return;
    const userId = nextId.current++;
    setMessages((prev) => [
      ...prev,
      {
        id: userId,
        role: "user",
        content: trimmed,
        createdAt: new Date().toISOString(),
      },
    ]);
    setAwaitingReply(true);
    timer.current = setTimeout(() => {
      const replyId = nextId.current++;
      setMessages((prev) => [
        ...prev,
        {
          id: replyId,
          role: "assistant",
          content: previewReply(trimmed),
          createdAt: new Date().toISOString(),
        },
      ]);
      setAwaitingReply(false);
    }, 900);
  }, []);

  const start = useCallback(
    async (prefillMessage?: string): Promise<void> => {
      setMessages([]);
      setSessionActive(true);
      if (prefillMessage) await send(prefillMessage);
    },
    [send],
  );

  const end = useCallback(async (): Promise<void> => {
    setSessionActive(false);
    setAwaitingReply(false);
  }, []);

  return {
    sessionId: 1,
    sessionActive,
    activeModel: PREVIEW_MODEL,
    messages,
    starting: false,
    sending: false,
    awaitingReply,
    start,
    send,
    end,
  };
}
