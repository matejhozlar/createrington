import { useCallback, useEffect, useRef, useState } from "react";
import { useToastActions } from "@/hooks/use-toast";
import { moveItem } from "@/lib/moveItem";
import { localStore } from "@/lib/storage";
import {
  createLayer,
  DEFAULT_OUTPUT,
  DEFAULT_RENDER,
  OUTPUT_MODES,
  RENDER_VIEWS,
  WORDMARK_LAYERS,
} from "../engine/settings";
import type {
  MinecraftMode,
  OutputSettings,
  RenderSettings,
  TextType,
  TitleLayer,
} from "../engine/types";

const STORAGE_KEY = "title-generator-project";
const STORAGE_VERSION = 1;
const MINECRAFT_MODES: MinecraftMode[] = ["1.20", "mojang"];

type Project = {
  layers: TitleLayer[];
  selectedId: string;
  render: RenderSettings;
  output: OutputSettings;
};

function wordmarkProject(): Project {
  const layers = WORDMARK_LAYERS();
  return {
    layers,
    selectedId: layers[0].id,
    render: DEFAULT_RENDER,
    output: DEFAULT_OUTPUT,
  };
}

function loadProject(): Project {
  try {
    const stored = localStore.getJson(STORAGE_KEY) as
      (Partial<Project> & { version?: number }) | null;
    if (
      !stored ||
      stored.version !== STORAGE_VERSION ||
      !stored.layers?.length
    ) {
      return wordmarkProject();
    }
    const layers = stored.layers.map((layer) => createLayer(layer));
    const output = { ...DEFAULT_OUTPUT, ...stored.output };
    if (!OUTPUT_MODES.includes(output.mode)) {
      output.mode = DEFAULT_OUTPUT.mode;
    }
    if (!MINECRAFT_MODES.includes(output.minecraftMode)) {
      output.minecraftMode = DEFAULT_OUTPUT.minecraftMode;
    }
    const render = { ...DEFAULT_RENDER, ...stored.render };
    if (!RENDER_VIEWS.includes(render.view)) {
      render.view = DEFAULT_RENDER.view;
    }
    return {
      layers,
      selectedId: layers.some((layer) => layer.id === stored.selectedId)
        ? stored.selectedId!
        : layers[0].id,
      render,
      output,
    };
  } catch {
    return wordmarkProject();
  }
}

export type LayerUpdate =
  Partial<TitleLayer> | ((layer: TitleLayer) => TitleLayer);

export function useTitleProject() {
  const toast = useToastActions();
  const [project, setProject] = useState(loadProject);
  const [revision, setRevision] = useState(0);
  const warnedRef = useRef(false);

  useEffect(() => {
    const layers = project.layers.map((layer) => ({
      ...layer,
      customTexture: null,
      customOverlay: null,
    }));
    const saved = localStore.setJson(STORAGE_KEY, {
      ...project,
      layers,
      version: STORAGE_VERSION,
    });
    if (saved || warnedRef.current) return;
    warnedRef.current = true;
    toast.warning("Changes to this title can't be saved in this browser");
  }, [project, toast]);

  const updateLayer = useCallback((id: string, update: LayerUpdate) => {
    setProject((current) => ({
      ...current,
      layers: current.layers.map((layer) =>
        layer.id !== id
          ? layer
          : typeof update === "function"
            ? update(layer)
            : { ...layer, ...update },
      ),
    }));
  }, []);

  const selectLayer = (id: string) => {
    setProject((current) => ({ ...current, selectedId: id }));
  };

  const addLayer = (type: TextType) => {
    setProject((current) => {
      const rows = current.layers
        .filter((layer) => layer.type === type)
        .map((layer) => layer.row);
      const row = rows.length ? Math.min(10, Math.max(...rows) + 1) : 0;
      const layer = createLayer({ text: "Text", type, row });
      return {
        ...current,
        layers: [...current.layers, layer],
        selectedId: layer.id,
      };
    });
  };

  const duplicateLayer = (id: string) => {
    setProject((current) => {
      const index = current.layers.findIndex((layer) => layer.id === id);
      if (index === -1) return current;
      const copy = createLayer({ ...current.layers[index], id: undefined });
      const layers = [...current.layers];
      layers.splice(index + 1, 0, copy);
      return { ...current, layers, selectedId: copy.id };
    });
  };

  const removeLayer = (id: string) => {
    setProject((current) => {
      if (current.layers.length <= 1) return current;
      const index = current.layers.findIndex((layer) => layer.id === id);
      const layers = current.layers.filter((layer) => layer.id !== id);
      const selectedId =
        current.selectedId === id
          ? layers[Math.max(0, index - 1)].id
          : current.selectedId;
      return { ...current, layers, selectedId };
    });
  };

  const moveLayer = (id: string, direction: -1 | 1) => {
    setProject((current) => {
      const index = current.layers.findIndex((layer) => layer.id === id);
      const layers =
        index === -1
          ? current.layers
          : moveItem(current.layers, index, direction);
      return layers === current.layers ? current : { ...current, layers };
    });
  };

  const setRender = (patch: Partial<RenderSettings>) => {
    setProject((current) => ({
      ...current,
      render: { ...current.render, ...patch },
    }));
  };

  const setOutput = (patch: Partial<OutputSettings>) => {
    setProject((current) => ({
      ...current,
      output: { ...current.output, ...patch },
    }));
  };

  const resetProject = () => {
    setProject(wordmarkProject());
    setRevision((current) => current + 1);
  };

  return {
    ...project,
    revision,
    selectedLayer:
      project.layers.find((layer) => layer.id === project.selectedId) ??
      project.layers[0],
    updateLayer,
    selectLayer,
    addLayer,
    duplicateLayer,
    removeLayer,
    moveLayer,
    setRender,
    setOutput,
    resetProject,
  };
}
