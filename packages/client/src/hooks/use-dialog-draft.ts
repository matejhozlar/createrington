import { useCallback, useState } from "react";

type DraftPatch<T> = Partial<T> | ((prev: T) => Partial<T>);

export function useDialogDraft<T extends object>(
  open: boolean,
  initial: T | (() => T),
) {
  const init = () => (typeof initial === "function" ? initial() : initial);
  const [state, setState] = useState(() => ({ open, draft: init() }));
  if (state.open !== open) {
    setState({ open, draft: open ? init() : state.draft });
  }

  const update = useCallback(
    (patch: DraftPatch<T>) =>
      setState((prev) => ({
        ...prev,
        draft: {
          ...prev.draft,
          ...(typeof patch === "function" ? patch(prev.draft) : patch),
        },
      })),
    [],
  );

  return [state.draft, update] as const;
}
