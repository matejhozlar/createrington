import { createContext } from "react";
import type { CryptoDataContextType } from "./types";

export const CryptoDataContext = createContext<
  CryptoDataContextType | undefined
>(undefined);
