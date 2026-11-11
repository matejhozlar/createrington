import type { EmbedData } from "@createrington/shared/api/embed";
import type { FocusTarget } from "../../focus";

export interface TabProps {
  data: EmbedData;
  set: (updates: Partial<EmbedData>) => void;
  focused?: FocusTarget | null;
  setFocused?: (next: FocusTarget | null) => void;
}
