import { useEffect, useState } from "react";
import { loadPlateAssets, type PlateAssets } from "../render/assets";

let pending: Promise<PlateAssets> | null = null;
let loaded: PlateAssets | null = null;

export function usePlateAssets() {
  const [assets, setAssets] = useState<PlateAssets | null>(loaded);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    pending ??= loadPlateAssets();
    pending.then(
      (result) => {
        loaded = result;
        if (!cancelled) setAssets(result);
      },
      () => {
        pending = null;
        if (!cancelled) setFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return { assets, failed };
}
