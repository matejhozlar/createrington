import { useEffect, useState } from "react";
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
  const [composed, setComposed] = useState<{
    source: HTMLCanvasElement;
    settings: OutputSettings;
    canvas: HTMLCanvasElement | null;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    if (!catalog) return;
    let cancelled = false;
    const handle = window.setTimeout(async () => {
      setRendering(true);
      try {
        const prepared = await prepareLayers(layers, catalog);
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
    }, RENDER_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [layers, render, catalog]);

  useEffect(() => {
    const source = state.image;
    if (!source) return;
    let cancelled = false;
    composeOutput(source, output)
      .then((canvas) => {
        if (!cancelled) {
          setComposed({ source, settings: output, canvas, error: null });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setComposed({
            source,
            settings: output,
            canvas: null,
            error: error instanceof Error ? error.message : "Export failed",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [state.image, output]);

  const current =
    !!state.image &&
    composed?.source === state.image &&
    composed.settings === output;

  return {
    image: state.image,
    output: state.image ? (composed?.canvas ?? null) : null,
    current,
    error: state.error ?? (current ? composed.error : null),
    rendering,
  };
}
