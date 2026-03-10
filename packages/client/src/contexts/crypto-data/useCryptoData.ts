import { useContext } from "react";
import { CryptoDataContext } from "./context";
import type { CryptoDataContextType } from "./types";

/**
 * Hook to access crypto data context
 *
 * @throws Error if used outside CryptoDataProvider
 */
export const useCryptoData = (): CryptoDataContextType => {
  const context = useContext(CryptoDataContext);

  if (!context) {
    throw new Error("useCryptoData must be used within CryptoDataProvider");
  }

  return context;
};
