import {
  BufferAttribute,
  BufferGeometry,
  FrontSide,
  Matrix4,
  Mesh,
  NearestFilter,
  PerspectiveCamera,
  Scene,
  ShaderMaterial,
  Texture,
  Vector3,
  WebGLRenderer,
} from "three";
import { autoCrop, createFrame, frameFrom, type Frame } from "./canvas";
import type { TitleCube, TitleMesh } from "./geometry";
import type { FaceDirection, RenderSettings, Vec3 } from "./types";

export type PreparedLayer = {
  mesh: TitleMesh;
  texture: HTMLCanvasElement;
};

export const MAX_RENDER_SIZE = 4096;
export const MAX_ANTIALIAS_RESOLUTION = 2048;

const CAMERA_PRESET = new Vector3(0, -170, -320);
const CAMERA_TARGET = new Vector3(0, 0, 0);
const CAMERA_FOV = 45;
const CAMERA_NEAR = 1;
const CAMERA_FAR = 30000;
const BOUNDS_ASPECT = 16 / 9;

const FACE_ORDER: FaceDirection[] = [
  "east",
  "west",
  "up",
  "down",
  "south",
  "north",
];

const VERTEX_SHADER = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAGMENT_SHADER = `
uniform sampler2D map;
varying vec2 vUv;
void main() {
  vec4 color = texture2D(map, vUv);
  if (color.a < 0.01) discard;
  gl_FragColor = color;
}`;

function cubeCorners(cube: TitleCube): { f: Vec3; t: Vec3 } {
  const f: Vec3 = [...cube.from];
  const t: Vec3 = [...cube.to];
  for (let axis = 0; axis < 3; axis++) {
    if (f[axis] === t[axis]) t[axis] += 0.001;
  }
  return { f, t };
}

function facePositions({ f, t }: { f: Vec3; t: Vec3 }): number[][] {
  return [
    [t[0], t[1], t[2], t[0], t[1], f[2], t[0], f[1], t[2], t[0], f[1], f[2]],
    [f[0], t[1], f[2], f[0], t[1], t[2], f[0], f[1], f[2], f[0], f[1], t[2]],
    [f[0], t[1], f[2], t[0], t[1], f[2], f[0], t[1], t[2], t[0], t[1], t[2]],
    [f[0], f[1], t[2], t[0], f[1], t[2], f[0], f[1], f[2], t[0], f[1], f[2]],
    [f[0], t[1], t[2], t[0], t[1], t[2], f[0], f[1], t[2], t[0], f[1], t[2]],
    [t[0], t[1], f[2], f[0], t[1], f[2], t[0], f[1], f[2], f[0], f[1], f[2]],
  ];
}

function buildGeometry(mesh: TitleMesh) {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (const cube of mesh.cubes) {
    const faces = facePositions(cubeCorners(cube));
    FACE_ORDER.forEach((direction, faceIndex) => {
      const uv = cube.faces[direction];
      if (!uv) return;
      const base = positions.length / 3;
      positions.push(...faces[faceIndex]);
      const [u0, v0, u1, v1] = uv;
      uvs.push(u0, 1 - v0, u1, 1 - v0, u0, 1 - v1, u1, 1 - v1);
      indices.push(base, base + 2, base + 1, base + 2, base + 3, base + 1);
    });
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(new Float32Array(positions), 3),
  );
  geometry.setAttribute("uv", new BufferAttribute(new Float32Array(uvs), 2));
  geometry.setIndex(indices);
  return geometry;
}

function createCamera(aspect: number, position: Vector3) {
  const camera = new PerspectiveCamera(
    CAMERA_FOV,
    aspect,
    CAMERA_NEAR,
    CAMERA_FAR,
  );
  camera.position.copy(position);
  camera.lookAt(CAMERA_TARGET);
  camera.updateMatrixWorld();
  return camera;
}

function projectBounds(layers: PreparedLayer[], position: Vector3) {
  const camera = createCamera(BOUNDS_ASPECT, position);
  const direction = CAMERA_TARGET.clone().sub(position).normalize();
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  const rotation = new Matrix4();
  const vertex = new Vector3();
  for (const { mesh } of layers) {
    rotation.makeRotationX((mesh.rotationX * Math.PI) / 180);
    for (const cube of mesh.cubes) {
      for (const face of facePositions(cubeCorners(cube))) {
        for (let i = 0; i < 12; i += 3) {
          vertex.set(face[i], face[i + 1], face[i + 2]);
          const toVertex = vertex.clone().sub(position).normalize();
          if (direction.dot(toVertex) <= 0) continue;
          vertex.applyMatrix4(rotation).project(camera);
          const x = (vertex.x + 1) / 2;
          const y = (-vertex.y + 1) / 2;
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    }
  }
  if (minX === Infinity || minX === maxX || minY === maxY) return null;
  return { minX, maxX, minY, maxY };
}

let sharedRenderer: WebGLRenderer | null = null;

function getRenderer() {
  if (!sharedRenderer) {
    sharedRenderer = new WebGLRenderer({
      canvas: document.createElement("canvas"),
      antialias: false,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    sharedRenderer.setPixelRatio(1);
    sharedRenderer.setClearColor(0x000000, 0);
  }
  return sharedRenderer;
}

function cleanEdges(frame: Frame) {
  const imageData = frame.ctx.getImageData(
    0,
    0,
    frame.canvas.width,
    frame.canvas.height,
  );
  const data = imageData.data;
  const width = frame.canvas.width;
  const height = frame.canvas.height;
  const width1 = width - 1;
  const height1 = height - 1;
  const row = width * 4;

  for (let i = data.length - 4; i >= 0; i -= 4) {
    const x = (i / 4) % width;
    const y = Math.floor(i / (4 * height));
    if (data[i + 3] === 0) {
      if (
        (x === 0 || data[i - 1] !== 0) &&
        (x === width1 || data[i + 7] !== 0) &&
        (y === 0 || data[i - row + 3] !== 0) &&
        (y === height1 || data[i + row + 3] !== 0)
      ) {
        let count = 0;
        let sr = 0;
        let sg = 0;
        let sb = 0;
        let sa = 0;
        if (x !== 0) {
          count++;
          sr += data[i - 4];
          sg += data[i - 3];
          sb += data[i - 2];
          sa += data[i - 1];
        }
        if (x !== width1) {
          count++;
          sr += data[i + 4];
          sg += data[i + 5];
          sb += data[i + 6];
          sa += data[i + 7];
        }
        if (y !== 0) {
          count++;
          sr += data[i - row];
          sg += data[i - row + 1];
          sb += data[i - row + 2];
          sa += data[i - row + 3];
        }
        if (y !== height1) {
          count++;
          sr += data[i + row];
          sg += data[i + row + 1];
          sb += data[i + row + 2];
          sa += data[i + row + 3];
        }
        data[i] = sr / count;
        data[i + 1] = sg / count;
        data[i + 2] = sb / count;
        data[i + 3] = sa / count;
      } else {
        const store: number[] = [];
        const queue = [i];
        while (store.length < 6 && queue.length !== 0) {
          const j = queue.shift()!;
          store.push(j);
          const jx = (j / 4) % width;
          if (jx !== 0 && data[j - 1] === 0 && !store.includes(j - 4)) {
            queue.push(j - 4);
          }
          if (jx !== width1 && data[j + 7] === 0 && !store.includes(j + 4)) {
            queue.push(j + 4);
          }
          if (
            Math.floor(j / (4 * height)) !== 0 &&
            data[j - row + 3] === 0 &&
            !store.includes(j - row)
          ) {
            queue.push(j - row);
          }
        }
        if (store.length >= 6) continue;
        for (const j of store) {
          const jx = (j / 4) % width;
          const jy = Math.floor(j / (4 * height));
          let count = 0;
          let sr = 0;
          let sg = 0;
          let sb = 0;
          let sa = 0;
          if (jx !== 0 && data[j - 1] !== 0) {
            count++;
            sr += data[j - 4];
            sg += data[j - 3];
            sb += data[j - 2];
            sa += data[j - 1];
          }
          if (jx !== width1 && data[j + 7] !== 0) {
            count++;
            sr += data[j + 4];
            sg += data[j + 5];
            sb += data[j + 6];
            sa += data[j + 7];
          }
          if (jy !== 0 && data[j - row + 3] !== 0) {
            count++;
            sr += data[j - row];
            sg += data[j - row + 1];
            sb += data[j - row + 2];
            sa += data[j - row + 3];
          }
          if (jy !== height1 && data[j + row + 3] !== 0) {
            count++;
            sr += data[j + row];
            sg += data[j + row + 1];
            sb += data[j + row + 2];
            sa += data[j + row + 3];
          }
          data[j] = sr / count;
          data[j + 1] = sg / count;
          data[j + 2] = sb / count;
          data[j + 3] = sa / count;
        }
      }
    } else if (
      (x === 0 || data[i - 1] === 0) &&
      (x === width1 || data[i + 7] === 0) &&
      (y === 0 || data[i - row + 3] === 0) &&
      (y === height1 || data[i + row + 3] === 0)
    ) {
      data[i + 3] = 0;
    } else {
      const store: number[] = [];
      const queue = [i];
      while (store.length < 6 && queue.length !== 0) {
        const j = queue.shift()!;
        store.push(j);
        const jx = (j / 4) % width;
        if (jx !== 0 && data[j - 1] !== 0 && !store.includes(j - 4)) {
          queue.push(j - 4);
        }
        if (jx !== width1 && data[j + 7] !== 0 && !store.includes(j + 4)) {
          queue.push(j + 4);
        }
        if (
          Math.floor(j / (4 * height)) !== 0 &&
          data[j - row + 3] !== 0 &&
          !store.includes(j - row)
        ) {
          queue.push(j - row);
        }
      }
      if (store.length >= 6) continue;
      for (const j of store) data[j + 3] = 0;
    }
  }
  frame.ctx.putImageData(imageData, 0, 0);
}

export function renderTitle(
  layers: PreparedLayer[],
  { resolution, antialias, cameraDistance }: RenderSettings,
): HTMLCanvasElement | null {
  const position = CAMERA_PRESET.clone().multiplyScalar(cameraDistance);
  const bounds = projectBounds(layers, position);
  if (!bounds) return null;
  const { minX, maxX, minY, maxY } = bounds;

  const aspect = (maxX - minX) / ((maxY - minY) / BOUNDS_ASPECT);
  const size = antialias
    ? Math.min(resolution * 2, MAX_RENDER_SIZE)
    : resolution;
  const outWidth = aspect > 1 ? size : size * aspect;
  const outHeight = aspect > 1 ? size / aspect : size;

  const renderer = getRenderer();
  renderer.setSize(Math.floor(outWidth), Math.floor(outHeight), false);

  const camera = createCamera(BOUNDS_ASPECT, position);
  const fullWidth = outWidth / (maxX - minX);
  const fullHeight = outHeight / (maxY - minY);
  camera.setViewOffset(
    fullWidth,
    fullHeight,
    minX * fullWidth,
    minY * fullHeight,
    outWidth,
    outHeight,
  );

  const scene = new Scene();
  const disposables: { dispose(): void }[] = [];
  for (const layer of layers) {
    const texture = new Texture(layer.texture);
    texture.magFilter = NearestFilter;
    texture.minFilter = NearestFilter;
    texture.needsUpdate = true;
    const material = new ShaderMaterial({
      uniforms: { map: { value: texture } },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      side: FrontSide,
      transparent: true,
    });
    const geometry = buildGeometry(layer.mesh);
    const mesh = new Mesh(geometry, material);
    mesh.rotation.x = (layer.mesh.rotationX * Math.PI) / 180;
    scene.add(mesh);
    disposables.push(texture, material, geometry);
  }

  try {
    renderer.render(scene, camera);
    const rendered = autoCrop(frameFrom(renderer.domElement));
    if (!rendered) return null;
    cleanEdges(rendered);
    const cropped = autoCrop(rendered);
    if (!cropped) return null;
    if (!antialias) return cropped.canvas;
    const blurred = createFrame(cropped.canvas.width, cropped.canvas.height);
    blurred.ctx.filter = "blur(0.75px)";
    blurred.ctx.drawImage(cropped.canvas, 0, 0);
    const out = createFrame(
      Math.floor(cropped.canvas.width / 2),
      Math.floor(cropped.canvas.height / 2),
    );
    out.ctx.drawImage(
      blurred.canvas,
      0,
      0,
      out.canvas.width,
      out.canvas.height,
    );
    return out.canvas;
  } finally {
    for (const item of disposables) item.dispose();
  }
}
