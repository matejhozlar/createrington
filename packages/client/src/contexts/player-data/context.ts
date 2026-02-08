import { createContext } from "react";
import type { PlayerDataContextType } from "./types";

export const PlayerDataContext = createContext<
  PlayerDataContextType | undefined
>(undefined);
