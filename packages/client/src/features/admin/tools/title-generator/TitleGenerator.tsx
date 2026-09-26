import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { AdminPageTitle } from "@/features/admin/components/AdminPageTitle";
import { LayerEditor } from "./components/LayerEditor";
import { LayerList } from "./components/LayerList";
import { OutputCard } from "./components/OutputCard";
import { PreviewCard } from "./components/PreviewCard";
import { RenderCard } from "./components/RenderCard";
import { useTitleCatalog } from "./hooks/use-title-assets";
import { useTitleProject } from "./hooks/use-title-project";
import { useTitleRender } from "./hooks/use-title-render";

function fileNameFor(texts: string[]) {
  const name = texts
    .map((text) =>
      text
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_"),
    )
    .filter(Boolean)
    .join("_");
  return name || "minecraft_title";
}

export function TitleGenerator() {
  const catalog = useTitleCatalog();
  const project = useTitleProject();
  const result = useTitleRender(
    project.layers,
    project.render,
    project.output,
    catalog.data,
  );

  return (
    <div className="flex flex-1 flex-col gap-4">
      <AdminPageHeader
        trail={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Tools", href: "/admin/tools" },
          { label: "Title Generator" },
        ]}
      />

      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-4 px-4 pb-4">
        <AdminPageTitle
          title="Title Generator"
          description="Build Minecraft-style 3D titles like the Createrington wordmark. It uses the same fonts, textures and render pipeline as the Minecraft Title Generator Blockbench plugin, so the output matches a Blockbench render."
          actions={
            <Button variant="outline" onClick={project.resetProject}>
              <RotateCcw className="size-4" />
              Reset to wordmark
            </Button>
          }
        />

        {catalog.error ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-destructive">
                Unable to load the fonts and textures.
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                They are served from the Minecraft Title Generator repository on
                GitHub. Check that raw.githubusercontent.com or cdn.jsdelivr.net
                is reachable.
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => catalog.refetch()}
              >
                Try again
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <PreviewCard
              output={result.output}
              rendering={result.rendering}
              error={result.error}
              loading={catalog.isLoading}
              fileName={fileNameFor(project.layers.map((layer) => layer.text))}
            />

            <div className="grid items-start gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
              <div className="flex flex-col gap-4">
                <LayerList
                  layers={project.layers}
                  selectedId={project.selectedLayer.id}
                  catalog={catalog.data}
                  onSelect={project.selectLayer}
                  onAdd={project.addLayer}
                  onDuplicate={project.duplicateLayer}
                  onRemove={project.removeLayer}
                  onMove={project.moveLayer}
                />
                <RenderCard
                  render={project.render}
                  onChange={project.setRender}
                />
                <OutputCard
                  output={project.output}
                  onChange={project.setOutput}
                />
              </div>

              {catalog.data ? (
                <LayerEditor
                  layer={project.selectedLayer}
                  catalog={catalog.data}
                  onChange={(update) =>
                    project.updateLayer(project.selectedLayer.id, update)
                  }
                />
              ) : (
                <Card>
                  <CardContent className="py-8 text-center text-sm text-muted-foreground">
                    Loading fonts and textures...
                  </CardContent>
                </Card>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
