import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Blocks, Eye, Rocket, TrendingUp } from "lucide-react";
import { BoostDialog } from "./BoostDialog";
import { PackModsDialog } from "./PackModsDialog";

interface PackCardProps {
  pack: {
    id: number;
    name: string;
    description: string | null;
    mods: Array<{
      id: number;
      modName: string;
      modUrl: string | null;
      thumbnailUrl: string | null;
      fileName: string;
    }>;
  };
  weight: number;
  boostUnits: number;
  totalWeight: number;
  myBoostUnits: number;
  boostUnitPrice: number;
}

export function PackCard({
  pack,
  weight,
  boostUnits,
  totalWeight,
  myBoostUnits,
  boostUnitPrice,
}: PackCardProps) {
  const [boostOpen, setBoostOpen] = useState(false);
  const [modsOpen, setModsOpen] = useState(false);
  const modCount = pack.mods.length;

  const probability =
    totalWeight > 0 ? Math.round((weight / totalWeight) * 100) : 0;

  return (
    <>
      <Card className="transition-colors hover:border-primary/20">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold truncate">{pack.name}</h3>
              {pack.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                  {pack.description}
                </p>
              )}
            </div>
            <div className="text-right shrink-0">
              <span className="text-lg font-bold font-mono tabular-nums text-primary">
                {probability}%
              </span>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                chance
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Progress value={probability} className="h-1.5" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <Blocks className="size-3" />
                  {modCount} mod{modCount !== 1 ? "s" : ""}
                </span>
                <span className="flex items-center gap-1">
                  <Rocket className="size-3" />
                  {boostUnits} boost{boostUnits !== 1 ? "s" : ""}
                </span>
                {myBoostUnits > 0 && (
                  <span className="flex items-center gap-1 text-primary">
                    <TrendingUp className="size-3" />
                    {myBoostUnits} yours
                  </span>
                )}
              </div>
              <span className="font-mono tabular-nums">
                w: {weight.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => setModsOpen(true)}
              disabled={modCount === 0}
            >
              <Eye className="size-3.5 mr-1.5" />
              Inspect
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setBoostOpen(true)}
            >
              <Rocket className="size-3.5 mr-1.5" />
              Boost
            </Button>
          </div>
        </CardContent>
      </Card>

      <PackModsDialog
        open={modsOpen}
        onOpenChange={setModsOpen}
        packName={pack.name}
        mods={pack.mods}
      />

      <BoostDialog
        open={boostOpen}
        onOpenChange={setBoostOpen}
        packId={pack.id}
        packName={pack.name}
        boostUnitPrice={boostUnitPrice}
      />
    </>
  );
}
