import { NavLink } from "react-router-dom";

export function Logo() {
  return (
    <NavLink
      to="/"
      className="flex items-center gap-3 flex-1 group-data-[state=collapsed]:hidden"
    >
      <img
        src="/assets/logo/logo.png"
        alt="Createrington Logo"
        className="size-10 object-contain"
      />

      <span className="font-medium text-xl truncate">Createrington</span>
    </NavLink>
  );
}
