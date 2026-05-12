import { useMemo, useState } from "react";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { ControlPanel } from "./components/ControlPanel";
import { ResultsTable } from "./components/ResultsTable";
import { DEFAULT_PARAMS, runSimulation } from "./compute";
import type { SimulatorParams, Snapshot } from "./types";
import snapshotExample from "./snapshot.example.json";

const localSnapshotModules = import.meta.glob<{ default: Snapshot }>(
  "./snapshot.local.json",
  { eager: true },
);
const localSnapshot =
  localSnapshotModules["./snapshot.local.json"]?.default ?? null;

const snapshot = (localSnapshot ?? snapshotExample) as Snapshot;

export function EconomySimulator() {
  const [params, setParams] = useState<SimulatorParams>(DEFAULT_PARAMS);

  const result = useMemo(() => runSimulation(snapshot, params), [params]);

  return (
    <div className="flex flex-1 flex-col gap-4">
      <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border bg-sidebar px-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin/dashboard">Admin</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin/tools">Tools</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Economy Simulator</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setParams(DEFAULT_PARAMS)}
        >
          <RotateCcw className="mr-2 size-4" />
          Reset to defaults
        </Button>
      </header>

      <div className="mx-auto w-full max-w-[1400px] flex flex-1 flex-col gap-4 px-4 pb-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Economy Simulator</h1>
          <p className="text-sm text-muted-foreground">
            Snapshot generated {snapshot.generatedAt.slice(0, 10)} with{" "}
            {snapshot.players.length} players. Adjust parameters to preview the
            cash + crypto normalization. Simulation only -- apply via migration
            in #739.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <ControlPanel params={params} onChange={setParams} />
          <ResultsTable result={result} />
        </div>
      </div>
    </div>
  );
}
