import { Outlet } from "react-router";
import { CryptoHeader } from "./components/CryptoHeader";
import { CryptoDisabledScreen } from "./components/CryptoDisabledScreen";
import { useAuth } from "@/contexts/auth";
import { trpc } from "@/lib/trpc";

export function CryptoLayout() {
  const { user } = useAuth();
  const statusQuery = trpc.public.crypto.status.useQuery(undefined, {
    refetchInterval: 30_000,
  });

  // Admins keep access so they can re-enable from the admin panel.
  const blocked = statusQuery.data?.enabled === false && !user?.isAdmin;

  return (
    <div className="flex flex-1 flex-col">
      <CryptoHeader />
      {blocked ? <CryptoDisabledScreen /> : <Outlet />}
    </div>
  );
}
