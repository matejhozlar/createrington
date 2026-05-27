import { useCallback, useState } from "react";
import {
  DEFAULT_ADMIN_CHAT_MODEL,
  isAdminChatModel,
  type AdminChatModel,
} from "../types";

function modelStorageKey(username: string | undefined): string | null {
  if (!username) return null;
  return `admin-chat:model:${username}`;
}

function loadStoredModel(username: string | undefined): AdminChatModel {
  const key = modelStorageKey(username);
  if (!key || typeof window === "undefined") return DEFAULT_ADMIN_CHAT_MODEL;
  try {
    const raw = window.localStorage.getItem(key);
    return isAdminChatModel(raw) ? raw : DEFAULT_ADMIN_CHAT_MODEL;
  } catch {
    return DEFAULT_ADMIN_CHAT_MODEL;
  }
}

interface UseModelSelectionResult {
  selectedModel: AdminChatModel;
  setSelectedModel: (next: AdminChatModel) => void;
}

export function useModelSelection(
  username: string | undefined,
): UseModelSelectionResult {
  const [selectedModel, setSelectedModelState] = useState<AdminChatModel>(() =>
    loadStoredModel(username),
  );

  const setSelectedModel = useCallback(
    (next: AdminChatModel): void => {
      setSelectedModelState(next);
      const key = modelStorageKey(username);
      if (!key || typeof window === "undefined") return;
      try {
        window.localStorage.setItem(key, next);
      } catch {
        // localStorage can throw in private mode / quota - best-effort only.
      }
    },
    [username],
  );

  return { selectedModel, setSelectedModel };
}
