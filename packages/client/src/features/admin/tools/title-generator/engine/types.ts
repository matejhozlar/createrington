export type Vec3 = [number, number, number];

export type FaceUv = [number, number, number, number];

export type FaceDirection = "north" | "east" | "south" | "west" | "up" | "down";

export type CharacterCube = {
  from: Vec3;
  to: Vec3;
  faces: Partial<Record<FaceDirection, FaceUv>>;
};

export type FontCharacters = Record<string, CharacterCube[]>;

export type TextureVariant = {
  name: string;
  author?: string;
};

export type TextureEntry = {
  id: string;
  name: string;
  author?: string;
  category?: string;
  variants?: Record<string, TextureVariant>;
};

export type TitleFont = {
  id: string;
  name: string;
  author?: string;
  description?: string;
  preview?: string;
  faces: number[][];
  ends: number[][];
  height: number;
  border: number;
  textureWidth: number;
  textureHeight: number;
  terminatorSpace?: boolean;
  forcedTerminators?: boolean;
  shifts?: Record<string, number>;
  spaceWidth?: number;
  characterSpacing?: number;
  autoBorder?: boolean;
  flat?: boolean;
  overlay?: boolean;
  baseFont: string;
  variants: string[];
};

export type Tileable = {
  id: string;
  name: string;
  author: string;
  category?: string;
  path: string;
  variants?: Record<string, { name: string; path: string }>;
};

export type FontTextures = {
  textures: TextureEntry[];
  overlays: TextureEntry[];
};

export type TextType = "top" | "bottom" | "small";

export type TextureSource = "premade" | "tileable" | "gradient" | "file";

export type OverlaySource = "premade" | "file";

export type BlendMode =
  | "multiply"
  | "color"
  | "lighter"
  | "screen"
  | "overlay"
  | "soft-light"
  | "hue"
  | "saturation"
  | "difference"
  | "source-over";

export type TitleLayer = {
  id: string;
  text: string;
  font: string;
  baseFont: string;
  fontVariant: string | null;
  type: TextType;
  row: number;
  textureSource: TextureSource;
  lastTextureSource: Exclude<TextureSource, "file">;
  texture: string;
  variant: string | null;
  tileable: string;
  tileableVariant: string | null;
  smoothGradient: boolean;
  gradientColour0: string;
  gradientColour1: string;
  gradientColour2: string;
  gradientColour3: string;
  gradientColour4: string;
  gradientColour1Enabled: boolean;
  gradientColour2Enabled: boolean;
  gradientColour3Enabled: boolean;
  customTextureType: "texture" | "tileable";
  customTexture: string | null;
  overlaySource: OverlaySource;
  overlay: string;
  overlayBlend: BlendMode;
  overlayColourBlend: BlendMode;
  overlayColour: string;
  overlayOpacity: number;
  customOverlay: string | null;
  tileableScale: number;
  tileableXOffset: number;
  tileableYOffset: number;
  tileableRandomRotations: boolean;
  tileableRandomMirroring: boolean;
  tileableTextureResolution: number;
  disableFontOverlay: boolean;
  hue: number;
  saturation: number;
  brightness: number;
  contrast: number;
  blend: BlendMode;
  colour: string;
  colourOpacity: number;
  customBorder: boolean;
  customBorderColour: string;
  fadeToBorder: boolean;
  customEdge: boolean;
  customEdgeColour: string;
  edgeBrightness: number;
  terminators: boolean;
  characterSpacing: number;
  rowSpacing: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  disableCharacterShifting: boolean;
};

export type TextureArgs = {
  font: string;
  texture: string;
  variant: string | null;
  tileable: string | null;
  tileableVariant: string | null;
  customTexture: string | null;
  customTextureType: "texture" | "tileable";
  customOverlay: string | null;
  overlay: string;
  gradientColours: [string, string, string, string, string] | null;
  smoothGradient: boolean;
  gradientColour1Enabled: boolean;
  gradientColour2Enabled: boolean;
  gradientColour3Enabled: boolean;
  overlayBlend: BlendMode;
  overlayColourBlend: BlendMode;
  overlayColour: string;
  overlayOpacity: number;
  tileableScale: number;
  tileableXOffset: number;
  tileableYOffset: number;
  tileableRandomRotations: boolean;
  tileableRandomMirroring: boolean;
  tileableTextureResolution: number;
  disableFontOverlay: boolean;
  hue: number;
  saturation: number;
  brightness: number;
  contrast: number;
  blend: BlendMode;
  colour: string;
  colourOpacity: number;
  customBorder: boolean;
  customBorderColour: string;
  fadeToBorder: boolean;
  customEdge: boolean;
  customEdgeColour: string;
  edgeBrightness: number;
};

export type OutputMode =
  "normal" | "square" | "custom" | "minecraft" | "createrington";

export type MinecraftMode = "1.20" | "mojang";

export type OutputSettings = {
  mode: OutputMode;
  resolutionWidth: number;
  resolutionHeight: number;
  minecraftMode: MinecraftMode;
  backgroundColourEnabled: boolean;
  backgroundColour: string;
  backgroundColour2Enabled: boolean;
  backgroundColour2: string;
  padding: number;
};

export type RenderSettings = {
  resolution: number;
  antialias: boolean;
  cameraDistance: number;
};
