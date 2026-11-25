import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth";
import { trpc } from "@/lib/trpc";

export function useAdminOverlay() {
  const { user } = useAuth();
  const isAdmin = user?.isAdmin ?? false;
  const { data } = useQuery({
    ...trpc.admin.overlay.get.queryOptions(),
    staleTime: Infinity,
    enabled: isAdmin,
  });
  return { isAdmin, overlay: isAdmin ? (data ?? null) : null };
}

export function useOverlayMask(): Record<string, string> {
  const { overlay } = useAdminOverlay();
  return overlay ? { [overlay.maskAttribute]: "true" } : {};
}
