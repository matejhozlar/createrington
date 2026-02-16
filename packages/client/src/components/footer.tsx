import { NavLink } from "react-router-dom";

export const Footer = () => {
  return (
    <footer className="w-full border-t bg-background px-5 md:px-8 py-12">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-7 gap-8">
          <div className="flex flex-col sm:justify-center col-span-2 lg:col-span-4 gap-2">
            <NavLink to="/" className="flex items-center gap-3">
              <img
                src="/assets/logo/logo.png"
                alt="Createrington Logo"
                className="size-10 object-contain"
              />

              <span className="font-medium text-xl truncate">
                Createrington
              </span>
            </NavLink>

            <p className="text-sm text-muted-foreground">
              A Create-powered Minecraft server for builders and engineers.
            </p>

            <p className="text-xs text-muted-foreground/60 mt-2">
              &copy; {new Date().getFullYear()} Createrington
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="font-semibold text-foreground">Quick Links</h3>

            <nav className="flex flex-col gap-2">
              <NavLink
                to="/"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Home
              </NavLink>

              <NavLink
                to="/rules"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Rules
              </NavLink>

              <NavLink
                to="/team"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Team
              </NavLink>
            </nav>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="font-semibold text-foreground">Community</h3>

            <nav className="flex flex-col gap-2">
              <NavLink
                to="/apply-to-join"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Apply
              </NavLink>

              <NavLink
                to="/blue-map"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Map
              </NavLink>

              <NavLink
                to="/online-players"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Players
              </NavLink>
            </nav>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="font-semibold text-foreground">Legal</h3>

            <nav className="flex flex-col gap-2">
              <NavLink
                to="/privacy"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Privacy Policy
              </NavLink>

              <NavLink
                to="/terms"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Terms of Service
              </NavLink>
            </nav>
          </div>
        </div>
      </div>
    </footer>
  );
};
