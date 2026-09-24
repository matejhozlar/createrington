export type CellAlign = "left" | "center" | "right";

export interface CellSegment {
  text: string;
  highlight: boolean;
}

export interface ParsedTable {
  title: string;
  intro: string[];
  columns: CellSegment[][];
  aligns: CellAlign[];
  rows: CellSegment[][][];
  notes: string[];
}

const SEPARATOR_CELL = /^:?-{2,}:?$/;

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

export function parseCell(cell: string): CellSegment[] {
  return cell
    .split(/(\*\*[^*]+\*\*)/)
    .filter(Boolean)
    .map((part) =>
      part.startsWith("**") && part.endsWith("**")
        ? { text: part.slice(2, -2), highlight: true }
        : { text: part, highlight: false },
    );
}

function parseAlign(cell: string, index: number): CellAlign {
  const left = cell.startsWith(":");
  const right = cell.endsWith(":");
  if (left && right) return "center";
  if (right) return "right";
  if (left) return "left";
  return index === 0 ? "left" : "right";
}

export function parseTable(source: string): ParsedTable {
  const lines = source.split(/\r?\n/).map((line) => line.trim());
  const tableLines = lines.filter((line) => line.startsWith("|"));
  const firstTableLine = lines.findIndex((line) => line.startsWith("|"));

  let title = "";
  const intro: string[] = [];
  const notes: string[] = [];

  lines.forEach((line, index) => {
    if (!line || line.startsWith("|")) return;
    if (line.startsWith("# ") && !title) {
      title = line.slice(2).trim();
      return;
    }
    if (firstTableLine === -1 || index < firstTableLine) intro.push(line);
    else notes.push(line);
  });

  const [headerLine, ...bodyLines] = tableLines;
  const header = headerLine ? splitRow(headerLine) : [];
  const separator =
    bodyLines[0] && splitRow(bodyLines[0]).every((c) => SEPARATOR_CELL.test(c))
      ? splitRow(bodyLines[0])
      : null;
  const dataLines = separator ? bodyLines.slice(1) : bodyLines;

  const aligns = header.map((_, index) =>
    parseAlign(separator?.[index] ?? "", index),
  );

  const rows = dataLines.map((line) => {
    const cells = splitRow(line);
    return header.map((_, index) => parseCell(cells[index] ?? ""));
  });

  return {
    title,
    intro,
    columns: header.map(parseCell),
    aligns,
    rows,
    notes,
  };
}
