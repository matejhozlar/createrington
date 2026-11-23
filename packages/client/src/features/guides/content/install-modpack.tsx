import { Download } from "lucide-react";
import { GuideImage } from "@/features/guides/components/GuideImage";
import { GuideLink } from "@/features/guides/components/GuideLink";
import type { Guide } from "@/features/guides/types";

export const installModpackGuide: Guide = {
  slug: "install-modpack",
  title: "Install the Modpack",
  description: "Get the CurseForge app and install the Createrington modpack.",
  icon: Download,
  category: "getting-started",
  image: "/assets/guides/download/curseforgeapp-game.webp",
  imageIcon: Download,
  estimatedMinutes: 10,
  steps: [
    {
      title: "Requirements",
      description: "What you need before getting started.",
      content: (
        <>
          <p>Before installing the modpack, make sure you have:</p>
          <ul className="list-disc pl-6 space-y-1 mt-2">
            <li>
              <strong>Minecraft Java Edition</strong> — a valid, purchased copy
            </li>
            <li>
              <strong>At least 6 GB of RAM</strong> — the modpack needs this to
              run smoothly
            </li>
            <li>
              <strong>A Discord account</strong> — required for registration and
              community access
            </li>
          </ul>
        </>
      ),
    },
    {
      title: "Get CurseForge App",
      description: "Download the CurseForge app from the official website.",
      content: (
        <>
          <p>
            Head to{" "}
            <GuideLink href="https://www.curseforge.com">
              curseforge.com
            </GuideLink>{" "}
            and click the <strong>Get CurseForge App</strong> button in the top
            right corner.
          </p>
          <GuideImage
            src="/assets/guides/download/curseforge-homepage.webp"
            alt="CurseForge homepage with Get CurseForge App button highlighted"
          />
          <p className="mt-4">
            On the download page, you'll see two options — either one works,
            pick whichever you prefer:
          </p>
          <ul className="list-disc pl-6 space-y-1 mt-2">
            <li>
              <strong>Download On Overwolf</strong> — installs CurseForge as
              part of the Overwolf platform, which includes an in-game overlay,
              automatic updates, and additional gaming tools
            </li>
            <li>
              <strong>Download Standalone</strong> — a lighter install with just
              the CurseForge app itself, no extra software
            </li>
          </ul>
          <GuideImage
            src="/assets/guides/download/curseforge-download.webp"
            alt="CurseForge download page with Overwolf and Standalone options"
          />
          <p className="mt-4">
            Run the installer and follow the on-screen instructions to complete
            the setup.
          </p>
        </>
      ),
    },
    {
      title: "Select Minecraft",
      description: "Choose Minecraft: Java Edition in the CurseForge app.",
      content: (
        <>
          <p>
            Open the CurseForge app. You'll see a <strong>Choose a Game</strong>{" "}
            screen — click on <strong>Minecraft</strong>.
          </p>
          <GuideImage
            src="/assets/guides/download/curseforgeapp-game.webp"
            alt="CurseForge app game selection screen with Minecraft highlighted"
          />
        </>
      ),
    },
    {
      title: "Find the Modpack",
      description: "Search for Createrington in the modpack browser.",
      content: (
        <>
          <p>
            Once in the Minecraft section, click <strong>Browse</strong> and use
            the search bar to search for <strong>Createrington</strong>.
          </p>
          <GuideImage
            src="/assets/guides/download/curseforgeapp-search.webp"
            alt="CurseForge app Minecraft section with search bar"
          />
          <p className="mt-4">
            You'll see <strong>Createrington Rails 'n Sails</strong> in the
            results. Click the green <strong>Install</strong> button to download
            the modpack.
          </p>
          <GuideImage
            src="/assets/guides/download/curseforgeapp-modpack.webp"
            alt="Createrington modpack in CurseForge search results with Install button"
          />
          <p className="mt-4">
            The app will automatically download all required mods and configure
            the correct Minecraft version.
          </p>
        </>
      ),
    },
    {
      title: "Connect to Server",
      description: "Join the Createrington server.",
      content: (
        <>
          <p>
            Once the modpack is installed, launch it from CurseForge. Go to{" "}
            <strong>Multiplayer</strong> — the server is already in your server
            list.
          </p>
          <p className="mt-3">
            Click <strong>Join Server</strong> and you're in! Make sure you've
            completed the registration process on Discord first.
          </p>
        </>
      ),
    },
  ],
};
