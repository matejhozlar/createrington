import { useContext } from "react";
import { ServerDataContext } from "./context";
import type { ServerDataContextType } from "./types";

/**
 * Hook to access server data context
 *
 * @throws Error if used outside ServerDataProvider
 */
export const useServerData = (): ServerDataContextType => {
  const context = useContext(ServerDataContext);

  if (!context) {
    throw new Error("useServerData must be used within ServerDataProvider");
  }

  return context;
};
