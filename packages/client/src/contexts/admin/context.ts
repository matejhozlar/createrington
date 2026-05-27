import { createContext } from "react";
import type { AdminPlayerContextType } from "./types";

export const AdminPlayersContext = createContext<
  AdminPlayerContextType | undefined
>(undefined);
