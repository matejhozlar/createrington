import { createContext, useContext, useState, type ReactNode } from "react";

export const DialogOpenContext = createContext<boolean | undefined>(undefined);

export function useChildrenFrozenWhileClosing(children: ReactNode): ReactNode {
  const open = useContext(DialogOpenContext);
  const [lastOpen, setLastOpen] = useState(children);
  if (open !== false && lastOpen !== children) setLastOpen(children);
  return open === false ? lastOpen : children;
}
