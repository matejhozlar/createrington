import { useCallback, useEffect, useState } from "react";
import {
  createLayer,
  DEFAULT_OUTPUT,
  DEFAULT_RENDER,
  WORDMARK_LAYERS,
} from "../engine/settings";
import type {
  OutputSettings,
  RenderSettings,
  TextType,
  TitleLayer,
} from "../engine/types";

const STORAGE_KEY = "title-generator-project";
const STORAGE_VERSION = 1;

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
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return wordmarkProject();
    const stored = JSON.parse(raw) as Partial<Project> & { version?: number };
    if (stored.version !== STORAGE_VERSION || !stored.layers?.length) {
      return wordmarkProject();
    }
    const layers = stored.layers.map((layer) => createLayer(layer));
    return {
      layers,
      selectedId: layers.some((layer) => layer.id === stored.selectedId)
        ? stored.selectedId!
        : layers[0].id,
      render: { ...DEFAULT_RENDER, ...stored.render },
      output: { ...DEFAULT_OUTPUT, ...stored.output },
    };
  } catch {
    return wordmarkProject();
  }
}

export type LayerUpdate =
  Partial<TitleLayer> | ((layer: TitleLayer) => TitleLayer);

export function useTitleProject() {
  const [project, setProject] = useState(loadProject);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...project, version: STORAGE_VERSION }),
      );
    } catch {
      return;
    }
  }, [project]);

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

  const selectLayer = useCallback((id: string) => {
    setProject((current) => ({ ...current, selectedId: id }));
  }, []);

  const addLayer = useCallback((type: TextType) => {
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
  }, []);

  const duplicateLayer = useCallback((id: string) => {
    setProject((current) => {
      const index = current.layers.findIndex((layer) => layer.id === id);
      if (index === -1) return current;
      const copy = createLayer({ ...current.layers[index], id: undefined });
      const layers = [...current.layers];
      layers.splice(index + 1, 0, copy);
      return { ...current, layers, selectedId: copy.id };
    });
  }, []);

  const removeLayer = useCallback((id: string) => {
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
  }, []);

  const moveLayer = useCallback((id: string, direction: -1 | 1) => {
    setProject((current) => {
      const index = current.layers.findIndex((layer) => layer.id === id);
      const target = index + direction;
      if (index === -1 || target < 0 || target >= current.layers.length) {
        return current;
      }
      const layers = [...current.layers];
      [layers[index], layers[target]] = [layers[target], layers[index]];
      return { ...current, layers };
    });
  }, []);

  const setRender = useCallback((patch: Partial<RenderSettings>) => {
    setProject((current) => ({
      ...current,
      render: { ...current.render, ...patch },
    }));
  }, []);

  const setOutput = useCallback((patch: Partial<OutputSettings>) => {
    setProject((current) => ({
      ...current,
      output: { ...current.output, ...patch },
    }));
  }, []);

  const resetProject = useCallback(() => setProject(wordmarkProject()), []);

  return {
    ...project,
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
