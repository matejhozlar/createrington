import { Outlet } from "react-router-dom";
import { CryptoHeader } from "./components/CryptoHeader";

export function CryptoLayout() {
  return (
    <div className="flex flex-1 flex-col">
      <CryptoHeader />
      <Outlet />
    </div>
  );
}
