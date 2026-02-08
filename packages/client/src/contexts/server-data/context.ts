import { createContext } from "react";
import type { ServerDataContextType } from "./types";

export const ServerDataContext = createContext<
  ServerDataContextType | undefined
>(undefined);
