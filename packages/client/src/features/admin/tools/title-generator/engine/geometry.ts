import type {
  FaceDirection,
  FaceUv,
  FontCharacters,
  TextType,
  TitleFont,
  Vec3,
} from "./types";

export type TitleCube = {
  from: Vec3;
  to: Vec3;
  faces: Partial<Record<FaceDirection, FaceUv>>;
};

export type TitleMesh = {
  cubes: TitleCube[];
  rotationX: number;
};

export type GeometryOptions = {
  type: TextType;
  row: number;
  rowSpacing: number;
  characterSpacing: number;
  scale: Vec3;
  terminators: boolean;
  disableCharacterShifting: boolean;
};

const FACE_DIRECTIONS: FaceDirection[] = [
  "north",
  "east",
  "south",
  "west",
  "up",
  "down",
];

const SPACER = "​";

type WordArgs = GeometryOptions & {
  font: TitleFont;
  characters: FontCharacters;
  spacerWidth: number;
  lastCharacter?: string;
  cubes: TitleCube[];
};

function typeFactor(type: TextType) {
  if (type === "bottom") return 0.75;
  if (type === "small") return 0.35;
  return 1;
}

function makeCharacter(char: string, offset: number, args: WordArgs) {
  const { font } = args;
  const shift =
    !args.disableCharacterShifting && args.lastCharacter
      ? font.shifts?.[args.lastCharacter + char]
      : undefined;
  if (shift) offset -= shift;

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  const cubes: TitleCube[] = [];

  for (const element of args.characters[char]) {
    const cube: TitleCube = {
      from: [...element.from],
      to: [...element.to],
      faces: {},
    };
    if (char === SPACER) {
      if (cube.to[0] > cube.from[0]) cube.to[0] += args.spacerWidth;
      else cube.from[0] += args.spacerWidth;
    }
    if (args.type === "small") {
      if (cube.to[2] > cube.from[2]) cube.to[2] -= 6;
      else cube.from[2] -= 6;
    }
    minX = Math.min(minX, cube.from[0], cube.to[0]);
    maxX = Math.max(maxX, cube.from[0], cube.to[0]);
    minZ = Math.min(minZ, cube.from[2], cube.to[2]);
    maxZ = Math.max(maxZ, cube.from[2], cube.to[2]);
    for (const direction of FACE_DIRECTIONS) {
      const uv = element.faces[direction];
      if (uv) {
        cube.faces[direction] = uv.map((value) => value / 16) as FaceUv;
      }
    }
    cubes.push(cube);
  }

  const height = font.height;
  for (const cube of cubes) {
    for (const point of [cube.from, cube.to]) {
      point[0] -= offset + maxX;
      point[2] -= minZ;
    }
    if (args.type === "bottom") {
      const drop =
        args.row * (height * 2 + 4) +
        args.rowSpacing * args.row +
        height * 2 +
        18;
      for (const point of [cube.from, cube.to]) {
        point[1] = point[1] * 2 - drop;
        point[0] *= 0.75;
        point[1] *= 0.75;
        point[2] = point[2] * 0.75 - 8;
      }
      if (!font.flat) {
        if (cube.to[2] > cube.from[2]) cube.to[2] += 24;
        else cube.from[2] += 24;
      }
    } else if (args.type === "small") {
      const drop =
        args.row * (height * 0.35) + args.rowSpacing * args.row + height * 0.35;
      for (const point of [cube.from, cube.to]) {
        point[2] -= maxZ - minZ;
        point[0] *= 0.35;
        point[1] = point[1] * 0.35 - drop;
        point[2] *= 0.35;
      }
    } else {
      const lift = args.row * (height + 4) + args.rowSpacing * args.row;
      for (const point of [cube.from, cube.to]) {
        point[2] -= (maxZ - minZ) / 2;
        point[1] += lift;
      }
    }
    for (const point of [cube.from, cube.to]) {
      point[0] *= args.scale[0];
      point[1] *= args.scale[1];
      point[2] *= args.scale[2];
    }
    args.cubes.push(cube);
  }

  args.lastCharacter = char;
  return offset + (maxX - minX + args.characterSpacing * args.scale[0]);
}

function makeWord(text: string, offset: number, args: WordArgs) {
  const start = args.cubes.length;
  for (const char of text) {
    if (args.characters[char]) offset = makeCharacter(char, offset, args);
  }
  if (args.font.autoBorder) {
    offset += 4;
    const word = args.cubes.slice(start);
    const min: Vec3 = [Infinity, Infinity, Infinity];
    const max: Vec3 = [-Infinity, -Infinity, -Infinity];
    for (const cube of word) {
      for (let axis = 0; axis < 3; axis++) {
        min[axis] = Math.min(min[axis], cube.from[axis], cube.to[axis]);
        max[axis] = Math.max(max[axis], cube.from[axis], cube.to[axis]);
      }
    }
    const size =
      ((2 * (args.scale[0] + args.scale[1])) / 2) * typeFactor(args.type);
    const { border, textureWidth, textureHeight } = args.font;
    const uv: FaceUv = [
      0,
      border / textureHeight,
      1 / textureWidth,
      (border + 1) / textureHeight,
    ];
    args.cubes.push({
      from: [max[0] + size, max[1] + size, max[2] + size],
      to: [min[0] - size, min[1] - size, min[2] - size],
      faces: Object.fromEntries(
        FACE_DIRECTIONS.map((direction) => [direction, uv]),
      ),
    });
  }
  return offset;
}

export function normalizeTitleText(text: string) {
  return text
    .replace(/A/g, "😳")
    .replace(/(\s|^)'/g, "$1😩")
    .replace(/(\s|^)"/g, "$1😩😩")
    .replace(/"/g, "''")
    .toLowerCase()
    .trim();
}

export function buildTitleMesh(
  normalizedText: string,
  font: TitleFont,
  characters: FontCharacters,
  options: GeometryOptions,
): TitleMesh {
  const args: WordArgs = {
    ...options,
    font,
    characters,
    spacerWidth: 0,
    cubes: [],
  };
  let text = normalizedText;
  if (args.characterSpacing && characters[SPACER]) {
    text = text.split("").join(SPACER);
    args.spacerWidth = args.characterSpacing - 1;
    args.characterSpacing = 0;
  }
  if (args.terminators || font.forcedTerminators) {
    text = font.terminatorSpace ? `┫ ${text} ┣` : `┫${text}┣`;
  }

  const words = characters[" "] ? [text] : text.split(" ");
  if (words.length === 1) {
    makeWord(text, 0, args);
  } else {
    let offset = 0;
    for (const word of words) {
      offset =
        makeWord(word, offset, args) +
        ((font.spaceWidth ?? 8) + args.characterSpacing) * args.scale[0];
    }
  }

  let min = Infinity;
  let max = -Infinity;
  for (const cube of args.cubes) {
    min = Math.min(min, cube.from[0], cube.to[0]);
    max = Math.max(max, cube.from[0], cube.to[0]);
  }
  let shift = (max - min) / 2;
  if (font.autoBorder) {
    shift -=
      ((2 * (args.scale[0] + args.scale[1])) / 2) * typeFactor(args.type);
  }
  for (const cube of args.cubes) {
    cube.from[0] += shift;
    cube.to[0] += shift;
  }

  return {
    cubes: args.cubes,
    rotationX: args.type === "bottom" ? -90 : 0,
  };
}
