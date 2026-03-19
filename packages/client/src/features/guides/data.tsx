import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Download,
  FolderInput,
  Puzzle,
  MessageSquare,
  Compass,
  TriangleAlert,
} from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { CopyBlock } from "./components/CopyBlock";

type GuideStep = {
  title: string;
  description: string;
  content: ReactNode;
};

type GuideCategory = "getting-started" | "modpacks" | "discord";

type Guide = {
  slug: string;
  title: string;
  description: string;
  icon: LucideIcon;
  category: GuideCategory;
  image?: string;
  imageIcon?: string;
  estimatedMinutes: number;
  steps: GuideStep[];
};

export type { Guide, GuideStep, GuideCategory };

const GUIDE_SECTIONS: { category: GuideCategory; title: string }[] = [
  { category: "getting-started", title: "Getting Started" },
  { category: "modpacks", title: "Modpacks" },
  { category: "discord", title: "Discord" },
];

export { GUIDE_SECTIONS };

export const guides: Guide[] = [
  {
    slug: "getting-started",
    title: "Getting Started",
    description:
      "Your first steps on the server — key locations, basic mechanics, and helpful tips.",
    icon: Compass,
    category: "getting-started",
    image: "/assets/hero/gondola-station.webp",
    imageIcon: "/assets/features/player-heads.webp",
    estimatedMinutes: 5,
    steps: [
      {
        title: "Welcome",
        description: "What to expect when you first join.",
        content: (
          <>
            <p>
              Welcome to <strong>Createrington</strong>! When you first join,
              you'll spawn at the central hub. From there you can explore the
              city, claim a plot, and start building.
            </p>
            <p className="mt-2">
              Take a moment to read the signs at spawn — they contain useful
              information about the server.
            </p>
          </>
        ),
      },
      {
        title: "Key Locations",
        description: "Important places you should know about.",
        content: (
          <>
            <p>Here are the key locations to get familiar with:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>
                <strong>Spawn Hub</strong> — the central area with portals and
                information boards
              </li>
              <li>
                <strong>Train Station</strong> — fast travel between districts
              </li>
              <li>
                <strong>Marketplace</strong> — buy and sell items with other
                players
              </li>
              <li>
                <strong>Plot World</strong> — claim your own building plot
              </li>
            </ul>
          </>
        ),
      },
      {
        title: "Basic Mechanics",
        description: "Core gameplay systems you'll use every day.",
        content: (
          <>
            <p>Createrington uses several custom mechanics:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>
                <strong>Economy</strong> — earn money by playing, trading, and
                completing tasks
              </li>
              <li>
                <strong>Create Mod</strong> — build mechanical contraptions,
                trains, and automation
              </li>
              <li>
                <strong>Plots</strong> — claim land to protect your builds
              </li>
              <li>
                <strong>Trains</strong> — use the rail network to travel across
                the map
              </li>
            </ul>
          </>
        ),
      },
      {
        title: "Tips & Tricks",
        description: "Helpful advice from experienced players.",
        content: (
          <>
            <p>A few tips to get the most out of your experience:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>
                Join the Discord server to stay up-to-date with announcements
              </li>
              <li>
                Don't be afraid to ask for help — the community is friendly
              </li>
              <li>Explore the train network to discover different districts</li>
              <li>
                Check the website for your profile stats, leaderboards, and more
              </li>
            </ul>
          </>
        ),
      },
    ],
  },
  {
    slug: "install-modpack",
    title: "Install the Modpack",
    description:
      "Get the CurseForge app and install the Createrington modpack.",
    icon: Download,
    category: "getting-started",
    image: "/assets/guides/download/curseforgeapp-game.webp",
    imageIcon: "/assets/logo/logo.png",
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
                <strong>Minecraft Java Edition</strong> — a valid, purchased
                copy
              </li>
              <li>
                <strong>At least 6 GB of RAM</strong> — the modpack needs this
                to run smoothly
              </li>
              <li>
                <strong>A Discord account</strong> — required for registration
                and community access
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
              <a
                href="https://www.curseforge.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2 hover:text-primary/80"
              >
                curseforge.com
              </a>{" "}
              and click the <strong>Get CurseForge App</strong> button in the
              top right corner.
            </p>
            <img
              src="/assets/guides/download/curseforge-homepage.webp"
              alt="CurseForge homepage with Get CurseForge App button highlighted"
              className="mt-4 rounded-lg border border-border"
            />
            <p className="mt-4">
              On the download page, you'll see two options — either one works,
              pick whichever you prefer:
            </p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>
                <strong>Download On Overwolf</strong> — installs CurseForge as
                part of the Overwolf platform, which includes an in-game
                overlay, automatic updates, and additional gaming tools
              </li>
              <li>
                <strong>Download Standalone</strong> — a lighter install with
                just the CurseForge app itself, no extra software
              </li>
            </ul>
            <img
              src="/assets/guides/download/curseforge-download.webp"
              alt="CurseForge download page with Overwolf and Standalone options"
              className="mt-4 rounded-lg border border-border"
            />
            <p className="mt-4">
              Run the installer and follow the on-screen instructions to
              complete the setup.
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
              Open the CurseForge app. You'll see a{" "}
              <strong>Choose a Game</strong> screen — click on{" "}
              <strong>Minecraft</strong>.
            </p>
            <img
              src="/assets/guides/download/curseforgeapp-game.webp"
              alt="CurseForge app game selection screen with Minecraft highlighted"
              className="mt-4 rounded-lg border border-border"
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
              Once in the Minecraft section, click <strong>Browse</strong> and
              use the search bar to search for <strong>Createrington</strong>.
            </p>
            <img
              src="/assets/guides/download/curseforgeapp-search.webp"
              alt="CurseForge app Minecraft section with search bar"
              className="mt-4 rounded-lg border border-border"
            />
            <p className="mt-4">
              You'll see <strong>Createrington: Cogs & Steam</strong> in the
              results. Click the green <strong>Install</strong> button to
              download the modpack.
            </p>
            <img
              src="/assets/guides/download/curseforgeapp-modpack.webp"
              alt="Createrington modpack in CurseForge search results with Install button"
              className="mt-4 rounded-lg border border-border"
            />
            <p className="mt-4">
              The app will automatically download all required mods and
              configure the correct Minecraft version.
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
              <strong>Multiplayer</strong> — the server is already in your
              server list.
            </p>
            <p className="mt-3">
              Click <strong>Join Server</strong> and you're in! Make sure you've
              completed the registration process on Discord first.
            </p>
          </>
        ),
      },
    ],
  },
  {
    slug: "import-modpack",
    title: "How to Import Modpacks",
    description:
      "Import a modpack manually into CurseForge from a downloaded file.",
    icon: FolderInput,
    category: "modpacks",
    image: "/assets/guides/download/curseforge-hero.webp",
    imageIcon: "/assets/logo/curseforge.webp",
    estimatedMinutes: 5,
    steps: [
      {
        title: "Get the Modpack File",
        description: "Download the .zip file you want to import.",
        content: (
          <>
            <p>
              If you received a modpack as a <strong>.zip</strong> file from our
              team (e.g. via Discord or a direct download link), save it
              somewhere you can easily find it.
            </p>
            <Alert className="mt-4 border-amber-900 bg-amber-950 text-amber-50">
              <TriangleAlert />
              <AlertTitle>Safety Warning</AlertTitle>
              <AlertDescription>
                Only import modpack files from sources you trust. Files
                from unknown sources could contain malicious content. We
                recommend only using files provided by our team.
              </AlertDescription>
            </Alert>
          </>
        ),
      },
      {
        title: "Click Import",
        description: "Open the import dialog in CurseForge.",
        content: (
          <>
            <p>
              Open the CurseForge app, go to the <strong>Minecraft</strong>{" "}
              section, and click the <strong>Import</strong> button at the top.
            </p>
            <img
              src="/assets/guides/download/curseforgeapp-import-button.webp"
              alt="CurseForge app with Import button highlighted"
              className="mt-4 rounded-lg border border-border"
            />
          </>
        ),
      },
      {
        title: "Import the Modpack",
        description: "Use a .zip file or a profile code.",
        content: (
          <>
            <p>
              In the Import Profile dialog, you'll see two options:
            </p>
            <img
              src="/assets/guides/download/curseforgeapp-import-menu.webp"
              alt="CurseForge import profile dialog"
              className="mt-4 rounded-lg border border-border"
            />
            <ul className="list-disc pl-6 space-y-1 mt-4">
              <li>
                <strong>Import Profile .zip</strong> — click{" "}
                <strong>Choose .zip file</strong> and select the modpack
                file you downloaded
              </li>
              <li>
                <strong>Use Profile Code</strong> — if you received a
                code instead, paste it into the text field and click{" "}
                <strong>Import</strong>. Codes are valid for 7 days
              </li>
            </ul>
            <p className="mt-4">
              CurseForge will extract and install the modpack
              automatically.
            </p>
          </>
        ),
      },
      {
        title: "Launch & Play",
        description: "Start the imported modpack.",
        content: (
          <>
            <p>
              Once the import is complete, the modpack will appear in your{" "}
              <strong>My Modpacks</strong> list. Click <strong>Play</strong> to
              launch it.
            </p>
          </>
        ),
      },
    ],
  },
  {
    slug: "add-custom-mods",
    title: "How to Add Custom Mods",
    description: "Add extra mods to your modpack installation in CurseForge.",
    icon: Puzzle,
    category: "modpacks",
    image: "/assets/features/modpack.webp",
    imageIcon: "/assets/features/cogwheel.webp",
    estimatedMinutes: 5,
    steps: [
      {
        title: "Open Your Modpack",
        description: "Find the modpack you want to modify.",
        content: (
          <>
            <p>
              In the CurseForge app, go to <strong>My Modpacks</strong> and
              click on the modpack you want to add mods to.
            </p>
          </>
        ),
      },
      {
        title: "Browse Mods",
        description: "Search for mods to add.",
        content: (
          <>
            <p>
              Click the <strong>Add More Content</strong> button to browse
              available mods. Use the search bar to find specific mods by name.
            </p>
          </>
        ),
      },
      {
        title: "Install a Mod",
        description: "Add the mod to your modpack.",
        content: (
          <>
            <p>
              Click <strong>Install</strong> next to the mod you want.
              CurseForge will automatically download it and any required
              dependencies.
            </p>
          </>
        ),
      },
      {
        title: "Verify & Launch",
        description: "Make sure everything works.",
        content: (
          <>
            <p>
              Launch the modpack to verify the new mod loads correctly. If you
              experience issues, you can remove the mod from the same menu.
            </p>
          </>
        ),
      },
    ],
  },
  {
    slug: "discord-commands",
    title: "Discord Commands",
    description: "Learn the most useful Discord bot commands for the server.",
    icon: MessageSquare,
    category: "discord",
    image: "/assets/guides/download/discord-hero.webp",
    imageIcon: "/assets/logo/discord.webp",
    estimatedMinutes: 5,
    steps: [
      {
        title: "Getting Started",
        description: "How to use commands in Discord.",
        content: (
          <>
            <p>
              All bot commands use Discord's <strong>slash command</strong>{" "}
              system. Type{" "}
              <code className="bg-muted px-1.5 py-0.5 rounded text-sm">/</code>{" "}
              in any bot channel to see available commands.
            </p>
            <p className="mt-2">
              Commands are organized by category. Most commands work in the
              designated bot channels.
            </p>
          </>
        ),
      },
      {
        title: "Economy Commands",
        description: "Check your balance, send money, and more.",
        content: (
          <>
            <p>Manage your in-game economy through Discord:</p>
            <div className="flex flex-col gap-2 mt-3">
              <CopyBlock label="Check balance" value="/balance" />
              <CopyBlock label="Send money" value="/pay @user [amount]" />
              <CopyBlock label="View leaderboard" value="/leaderboard" />
            </div>
          </>
        ),
      },
      {
        title: "Social Commands",
        description: "Interact with other players.",
        content: (
          <>
            <p>Connect with the community:</p>
            <div className="flex flex-col gap-2 mt-3">
              <CopyBlock label="View profile" value="/profile" />
              <CopyBlock label="Check playtime" value="/playtime" />
            </div>
          </>
        ),
      },
      {
        title: "Utility Commands",
        description: "Helpful tools and information.",
        content: (
          <>
            <p>Useful commands for everyday gameplay:</p>
            <div className="flex flex-col gap-2 mt-3">
              <CopyBlock label="Server status" value="/status" />
              <CopyBlock label="Open a ticket" value="/ticket" />
            </div>
          </>
        ),
      },
    ],
  },
];
