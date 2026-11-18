import { useContext } from "react";
import { PlayerDataContext } from "./context";
import type { PlayerDataContextType } from "./types";

export const usePlayerData = (): PlayerDataContextType => {
  const context = useContext(PlayerDataContext);

  if (!context) {
    throw new Error("usePlayerData must be used within PlayerDataProvider");
  }

  return context;
};
