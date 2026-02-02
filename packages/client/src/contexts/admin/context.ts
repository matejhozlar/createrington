import { createContext } from "react";
import { AdminPlayerContextType } from "./types";

export const AdminPlayersContext = createContext<
  AdminPlayerContextType | undefined
>(undefined);
