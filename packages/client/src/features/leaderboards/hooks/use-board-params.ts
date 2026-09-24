import { useSearchParams } from "react-router";
import {
  decodeStatParam,
  encodeStatParam,
} from "@createrington/shared/minecraft-stats";
import type { Stat } from "../components/StatPicker";

export type Board = "records" | "playtime" | "balance";

const BOARD_VALUES: Board[] = ["records", "playtime", "balance"];
const DEFAULT_BOARD: Board = "records";

function parseBoard(value: string | null): Board {
  return BOARD_VALUES.find((board) => board === value) ?? DEFAULT_BOARD;
}

interface BoardParamsPatch {
  board?: Board;
  stat?: Stat | null;
  search?: string;
}

export function useBoardParams() {
  const [params, setParams] = useSearchParams();
  const board = parseBoard(params.get("board"));
  const stat = board === "records" ? decodeStatParam(params.get("stat")) : null;
  const search = params.get("q") ?? "";

  const update = (patch: BoardParamsPatch) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (patch.board !== undefined) {
          if (patch.board === DEFAULT_BOARD) next.delete("board");
          else next.set("board", patch.board);
          if (patch.board !== "records") next.delete("stat");
        }
        if (patch.stat !== undefined) {
          if (patch.stat) next.set("stat", encodeStatParam(patch.stat));
          else next.delete("stat");
        }
        if (patch.search !== undefined) {
          if (patch.search) next.set("q", patch.search);
          else next.delete("q");
        }
        return next;
      },
      { replace: true, preventScrollReset: true },
    );

  return { board, stat, search, update };
}
