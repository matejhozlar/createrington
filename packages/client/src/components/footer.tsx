import { NavLink } from "react-router";
import { Mail } from "lucide-react";
import { DiscordIcon } from "@/components/icons/discord";
import { CurseForgeIcon } from "@/components/icons/curseforge";
import {
  CONTACT_EMAIL,
  CURSEFORGE_MODPACK_URL,
  DISCORD_INVITE_URL,
} from "@/lib/external-urls";

const SOCIAL_LINKS = [
  {
    label: "Discord",
    href: DISCORD_INVITE_URL,
    Icon: DiscordIcon,
    external: true,
  },
  {
    label: "CurseForge modpack",
    href: CURSEFORGE_MODPACK_URL,
    Icon: CurseForgeIcon,
    external: true,
  },
  {
    label: `Email ${CONTACT_EMAIL}`,
    href: `mailto:${CONTACT_EMAIL}`,
    Icon: Mail,
    external: false,
  },
] as const;

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

            <ul className="flex items-center gap-4 mt-2">
              {SOCIAL_LINKS.map(({ label, href, Icon, external }) => (
                <li key={label}>
                  <a
                    href={href}
                    aria-label={label}
                    title={label}
                    {...(external
                      ? { target: "_blank", rel: "noopener noreferrer" }
                      : {})}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Icon className="size-5" />
                  </a>
                </li>
              ))}
            </ul>

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

              <NavLink
                to="/guides"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Guides
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

              <NavLink
                to="/donate"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Donate
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
