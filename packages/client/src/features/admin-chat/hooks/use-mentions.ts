import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { RepoSuggestion } from "@createrington/shared/admin-chat";
import { trpc } from "@/lib/trpc";
import type { MentionState } from "../types";

export function detectMention(
  value: string,
  cursor: number,
): MentionState | null {
  if (cursor <= 0) return null;
  const before = value.slice(0, cursor);
  const at = before.lastIndexOf("@");
  if (at === -1) return null;
  const prev = at > 0 ? before[at - 1] : "";
  if (prev && !/\s/.test(prev)) return null;
  const query = before.slice(at + 1);
  if (/[\s\n]/.test(query)) return null;
  if (!/^[A-Za-z0-9._/-]*$/.test(query)) return null;
  return { start: at, query };
}

interface UseMentionsResult {
  mention: MentionState | null;
  matches: RepoSuggestion[];
  index: number;
  setIndex: (i: number | ((prev: number) => number)) => void;
  onValueChange: (value: string, cursor: number) => void;
  clear: () => void;
  acceptAt: (
    repo: RepoSuggestion,
    current: string,
  ) => { value: string; cursor: number } | null;
  syncFromCursor: (ta: HTMLTextAreaElement) => void;
}

export function useMentions(): UseMentionsResult {
  const [mention, setMention] = useState<MentionState | null>(null);
  const [index, setIndex] = useState(0);
  const { data: repos } = useQuery(
    trpc.admin.chat.repos.queryOptions(undefined, {
      enabled: mention !== null,
      staleTime: Infinity,
    }),
  );

  const matches = useMemo<RepoSuggestion[]>(() => {
    if (!mention || !repos) return [];
    const q = mention.query.toLowerCase();
    return repos.filter((r) => r.name.toLowerCase().includes(q)).slice(0, 8);
  }, [mention, repos]);

  const onValueChange = useCallback((value: string, cursor: number): void => {
    const next = detectMention(value, cursor);
    setMention(next);
    if (next) setIndex(0);
  }, []);

  const clear = useCallback((): void => {
    setMention(null);
  }, []);

  const acceptAt = useCallback(
    (
      repo: RepoSuggestion,
      current: string,
    ): { value: string; cursor: number } | null => {
      if (!mention) return null;
      const before = current.slice(0, mention.start);
      const after = current.slice(mention.start + mention.query.length + 1);
      const inserted = `${repo.fullName} `;
      const nextValue = before + inserted + after;
      const nextCursor = before.length + inserted.length;
      setMention(null);
      return { value: nextValue, cursor: nextCursor };
    },
    [mention],
  );

  const syncFromCursor = useCallback((ta: HTMLTextAreaElement): void => {
    const next = detectMention(ta.value, ta.selectionStart ?? ta.value.length);
    setMention(next);
  }, []);

  return {
    mention,
    matches,
    index,
    setIndex,
    onValueChange,
    clear,
    acceptAt,
    syncFromCursor,
  };
}
