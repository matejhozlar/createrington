import { useContext } from "react";
import { AdminPlayersContext } from "./context";
import { AdminPlayerContextType } from "./types";

/**
 * Hook to access admin player context
 */
export const useAdminPlayers = (): AdminPlayerContextType => {
  const context = useContext(AdminPlayersContext);

  if (!context) {
    throw new Error("useAdminPlayers must be used within AdminPlayerProvider");
  }

  return context;
};
