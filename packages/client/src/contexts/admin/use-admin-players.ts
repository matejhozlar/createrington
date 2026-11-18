import { useContext } from "react";
import { AdminPlayersContext } from "./context";
import type { AdminPlayersContextType } from "./types";

/**
 * Hook to access admin player context
 */
export const useAdminPlayers = (): AdminPlayersContextType => {
  const context = useContext(AdminPlayersContext);

  if (!context) {
    throw new Error("useAdminPlayers must be used within AdminPlayersProvider");
  }

  return context;
};
