import { AppLayout } from "@/components/app-layout";
import { NotFound } from "@/pages/not-found";
import type { RenderUnavailableReason } from "../hooks/use-render-data";

export function RenderUnavailable({
  reason,
}: {
  reason: RenderUnavailableReason;
}) {
  return (
    <>
      <div id="render-unavailable" hidden />
      {reason === "rejected" && (
        <AppLayout>
          <NotFound />
        </AppLayout>
      )}
    </>
  );
}
