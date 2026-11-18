import { createContext } from "react";
import type { AdminPlayersContextType } from "./types";

export const AdminPlayersContext = createContext<
  AdminPlayersContextType | undefined
>(undefined);
