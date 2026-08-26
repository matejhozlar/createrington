export const MINECRAFT_COLORS: Record<string, string> = {
  "0": "#000000",
  "1": "#0000AA",
  "2": "#00AA00",
  "3": "#00AAAA",
  "4": "#AA0000",
  "5": "#AA00AA",
  "6": "#FFAA00",
  "7": "#AAAAAA",
  "8": "#555555",
  "9": "#5555FF",
  a: "#55FF55",
  b: "#55FFFF",
  c: "#FF5555",
  d: "#FF55FF",
  e: "#FFFF55",
  f: "#FFFFFF",
};

export interface MinecraftTextSegment {
  text: string;
  color: string | null;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  obfuscated: boolean;
}

const RESET: Omit<MinecraftTextSegment, "text"> = {
  color: null,
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  obfuscated: false,
};

const FORMAT_CODE = /[&§]([0-9a-fk-or])/gi;

export function parseMinecraftText(text: string): MinecraftTextSegment[][] {
  return text.split(/\r?\n/).map((line) => {
    const segments: MinecraftTextSegment[] = [];
    let style = { ...RESET };
    let last = 0;

    for (const match of line.matchAll(FORMAT_CODE)) {
      const before = line.slice(last, match.index);
      if (before) segments.push({ text: before, ...style });
      last = match.index + match[0].length;

      const code = match[1].toLowerCase();
      if (code in MINECRAFT_COLORS) {
        style = { ...RESET, color: MINECRAFT_COLORS[code] };
      } else if (code === "r") {
        style = { ...RESET };
      } else {
        style = {
          ...style,
          bold: style.bold || code === "l",
          italic: style.italic || code === "o",
          underline: style.underline || code === "n",
          strikethrough: style.strikethrough || code === "m",
          obfuscated: style.obfuscated || code === "k",
        };
      }
    }

    const rest = line.slice(last);
    if (rest || segments.length === 0) segments.push({ text: rest, ...style });
    return segments;
  });
}
