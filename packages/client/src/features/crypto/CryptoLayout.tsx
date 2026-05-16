import { Outlet } from "react-router-dom";
import { CryptoHeader } from "./components/CryptoHeader";
import { CryptoDisabledScreen } from "./components/CryptoDisabledScreen";
import { useAuth } from "@/contexts/auth";
import { trpc } from "@/lib/trpc";

export function CryptoLayout() {
  const { user } = useAuth();
  const statusQuery = trpc.public.crypto.status.useQuery(undefined, {
    refetchInterval: 30_000,
  });

  // Admins keep access while the market is paused so they can flip the
  // toggle back from the admin panel without ever losing the route.
  const blocked = statusQuery.data?.enabled === false && !user?.isAdmin;

  return (
    <div className="flex flex-1 flex-col">
      <CryptoHeader />
      {blocked ? <CryptoDisabledScreen /> : <Outlet />}
    </div>
  );
}
