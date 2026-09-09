import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { mountSkinRunner } from "@/lib/skin-runner";

type SkinRunnerProps = {
  uuid: string;
  username: string;
  className?: string;
};

export function SkinRunner({ uuid, username, className }: SkinRunnerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handle = mountSkinRunner(canvas, { uuid, username });
    return () => handle.destroy();
  }, [uuid, username]);

  return (
    <canvas
      ref={canvasRef}
      tabIndex={0}
      aria-label={`Endless runner starring ${username}`}
      className={cn(
        "block size-full touch-none select-none outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    />
  );
}
