import { useEffect, useMemo, useState } from "react";
import type { Catalog } from "../engine/assets";
import { composeOutput } from "../engine/output";
import { prepareLayers } from "../engine/pipeline";
import { renderTitle } from "../engine/render";
import type {
  OutputSettings,
  RenderSettings,
  TitleLayer,
} from "../engine/types";

const RENDER_DEBOUNCE_MS = 200;

type RenderState = {
  image: HTMLCanvasElement | null;
  error: string | null;
};

export function useTitleRender(
  layers: TitleLayer[],
  render: RenderSettings,
  output: OutputSettings,
  catalog: Catalog | undefined,
) {
  const [state, setState] = useState<RenderState>({ image: null, error: null });
  const [rendering, setRendering] = useState(false);

  useEffect(() => {
    if (!catalog) return;
    let cancelled = false;
    const run = async () => {
      setRendering(true);
      try {
        const prepared = await prepareLayers(layers, catalog, render.view);
        if (cancelled) return;
        setState({ image: renderTitle(prepared, render), error: null });
      } catch (error) {
        if (cancelled) return;
        setState({
          image: null,
          error: error instanceof Error ? error.message : "Render failed",
        });
      } finally {
        if (!cancelled) setRendering(false);
      }
    };
    const handle = window.setTimeout(() => void run(), RENDER_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [layers, render, catalog]);

  const composed = useMemo(() => {
    if (!state.image) return null;
    try {
      return { canvas: composeOutput(state.image, output), error: null };
    } catch (error) {
      return {
        canvas: null,
        error: error instanceof Error ? error.message : "Export failed",
      };
    }
  }, [state.image, output]);

  return {
    image: state.image,
    output: composed?.canvas ?? null,
    current: composed !== null,
    error: state.error ?? composed?.error ?? null,
    rendering,
  };
}
