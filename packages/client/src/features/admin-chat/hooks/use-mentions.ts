import { useCallback, useMemo, useRef, useState } from "react";
import { fetchRepos } from "../api";
import type { MentionState, RepoSuggestion } from "../types";

/**
 * Walk back from the cursor to find an active `@`-mention. Returns the
 * mention state or null. Triggers only when `@` sits at a word boundary
 * (start of input or after whitespace) and the query is plain
 * repo-name-ish text: a space or newline closes the menu.
 */
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

/**
 * Hook that manages @-mention autocomplete state + lazy-loaded repo list.
 * Repos are fetched once on the first `@` keystroke so opening the drawer
 * doesn't fan out to Gitea if the admin never uses the feature.
 */
export function useMentions(): UseMentionsResult {
  const [repos, setRepos] = useState<RepoSuggestion[] | null>(null);
  // Mirror of `repos` for the guard inside loadRepos. Using a ref keeps
  // loadRepos stable across repo-list state transitions, so callbacks
  // that depend on it (onValueChange, syncFromCursor) don't get fresh
  // identities on every keystroke after repos finish loading.
  const reposRef = useRef<RepoSuggestion[] | null>(null);
  const reposLoadingRef = useRef(false);
  const [mention, setMention] = useState<MentionState | null>(null);
  const [index, setIndex] = useState(0);

  const loadRepos = useCallback(async (): Promise<void> => {
    if (reposRef.current !== null || reposLoadingRef.current) return;
    reposLoadingRef.current = true;
    try {
      const data = await fetchRepos();
      const loaded = data.repos ?? [];
      reposRef.current = loaded;
      setRepos(loaded);
    } catch {
      reposRef.current = [];
      setRepos([]);
    } finally {
      reposLoadingRef.current = false;
    }
  }, []);

  const matches = useMemo<RepoSuggestion[]>(() => {
    if (!mention || !repos) return [];
    const q = mention.query.toLowerCase();
    return repos.filter((r) => r.name.toLowerCase().includes(q)).slice(0, 8);
  }, [mention, repos]);

  const onValueChange = useCallback(
    (value: string, cursor: number): void => {
      const next = detectMention(value, cursor);
      setMention(next);
      if (next) {
        void loadRepos();
        setIndex(0);
      }
    },
    [loadRepos],
  );

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

  const syncFromCursor = useCallback(
    (ta: HTMLTextAreaElement): void => {
      // Arrow keys / clicks move the cursor without firing onChange, so
      // re-detect on keyup / click to keep the menu state in sync with
      // where the caret actually sits.
      const next = detectMention(
        ta.value,
        ta.selectionStart ?? ta.value.length,
      );
      setMention(next);
      if (next) void loadRepos();
    },
    [loadRepos],
  );

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
