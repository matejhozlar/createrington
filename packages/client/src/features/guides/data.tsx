/* eslint-disable react-refresh/only-export-components */
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Download,
  RefreshCw,
  FolderInput,
  Puzzle,
  MessageSquare,
  // Compass, // TODO: re-enable when Getting Started guide is added back
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
  imageIcon?: string | LucideIcon;
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
  // TODO: Fill in "Getting Started" guide with real server info
  // {
  //   slug: "getting-started",
  //   title: "Getting Started",
  //   description: "Your first steps on the server — key locations, basic mechanics, and helpful tips.",
  //   icon: Compass,
  //   category: "getting-started",
  //   image: "/assets/hero/gondola-station.webp",
  //   imageIcon: "/assets/features/player-heads.webp",
  //   estimatedMinutes: 5,
  //   steps: [...],
  // },
  {
    slug: "install-modpack",
    title: "Install the Modpack",
    description:
      "Get the CurseForge app and install the Createrington modpack.",
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
              className="mt-4 w-full rounded-lg border border-border bg-muted object-cover"
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
              className="mt-4 w-full rounded-lg border border-border bg-muted object-cover"
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
              className="mt-4 w-full rounded-lg border border-border bg-muted object-cover"
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
              className="mt-4 w-full rounded-lg border border-border bg-muted object-cover"
            />
            <p className="mt-4">
              You'll see <strong>Createrington: Cogs & Steam</strong> in the
              results. Click the green <strong>Install</strong> button to
              download the modpack.
            </p>
            <img
              src="/assets/guides/download/curseforgeapp-modpack.webp"
              alt="Createrington modpack in CurseForge search results with Install button"
              className="mt-4 w-full rounded-lg border border-border bg-muted object-cover"
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
    slug: "update-modpack",
    title: "Update the Modpack",
    description:
      "How to update the Createrington modpack to the latest version.",
    icon: RefreshCw,
    category: "getting-started",
    image: "/assets/guides/download/curseforgeapp-change-version-button.webp",
    imageIcon: RefreshCw,
    estimatedMinutes: 5,
    steps: [
      {
        title: "Open the Createrington modpack",
        description: "Find the modpack in CurseForge.",
        content: (
          <>
            <p>
              In the CurseForge app, go to <strong>My Modpacks</strong> and
              click on <strong>Createrington</strong>.
            </p>
            <img
              src="/assets/guides/download/curseforgeapp-modpack-properties-button.webp"
              alt="Createrington modpack page in CurseForge"
              className="mt-4 w-full rounded-lg border border-border bg-muted object-cover"
            />
          </>
        ),
      },
      {
        title: "Check Content Management",
        description: "Make sure content management is disabled.",
        content: (
          <>
            <p>
              Click the <strong>three-dot menu</strong> next to the Play button
              and select <strong>Profile Options</strong>.
            </p>
            <p className="mt-4">
              Make sure the{" "}
              <strong>Allow content management for this profile</strong>{" "}
              checkbox is <strong>unchecked</strong>. If it's checked, uncheck
              it and click <strong>Done</strong>.
            </p>
            <img
              src="/assets/guides/download/curseforgeapp-content-management.webp"
              alt="CurseForge Profile Options with content management disabled"
              className="mt-4 w-full rounded-lg border border-border bg-muted object-cover"
            />
            <p className="mt-4">
              The <strong>Change Version</strong> option only appears when
              content management is disabled. If you've added custom mods,
              you'll need to disable content management first, update, and then
              re-enable it.
            </p>
          </>
        ),
      },
      {
        title: "Change Version",
        description: "Select the latest modpack version.",
        content: (
          <>
            <p>
              Click the <strong>three-dot menu</strong> again — you'll now see{" "}
              <strong>Change Version</strong> at the top of the menu. Click it.
            </p>
            <img
              src="/assets/guides/download/curseforgeapp-change-version-button.webp"
              alt="CurseForge three-dot menu with Change Version option"
              className="mt-4 w-full rounded-lg border border-border bg-muted object-cover"
            />
            <p className="mt-4">
              Select the latest version from the list and confirm. CurseForge
              will download and apply the update automatically.
            </p>
          </>
        ),
      },
      {
        title: "Launch & Play",
        description: "Start the updated modpack.",
        content: (
          <>
            <p>
              Once the update is complete, click <strong>Play</strong> to launch
              the modpack with the latest version.
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
                Only import modpack files from sources you trust. Files from
                unknown sources could contain malicious content. We recommend
                only using files provided by our team.
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
              className="mt-4 w-full rounded-lg border border-border bg-muted object-cover"
            />
          </>
        ),
      },
      {
        title: "Import the Modpack",
        description: "Use a .zip file or a profile code.",
        content: (
          <>
            <p>In the Import Profile dialog, you'll see two options:</p>
            <img
              src="/assets/guides/download/curseforgeapp-import-menu.webp"
              alt="CurseForge import profile dialog"
              className="mt-4 w-full rounded-lg border border-border bg-muted object-cover"
            />
            <ul className="list-disc pl-6 space-y-1 mt-4">
              <li>
                <strong>Import Profile .zip</strong> — click{" "}
                <strong>Choose .zip file</strong> and select the modpack file
                you downloaded
              </li>
              <li>
                <strong>Use Profile Code</strong> — if you received a code
                instead, paste it into the text field and click{" "}
                <strong>Import</strong>. Codes are valid for 7 days
              </li>
            </ul>
            <p className="mt-4">
              CurseForge will extract and install the modpack automatically.
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
        title: "Open the Createrington modpack",
        description: "Find the modpack in CurseForge.",
        content: (
          <>
            <p>
              In the CurseForge app, go to <strong>My Modpacks</strong> and
              click on <strong>Createrington</strong>.
            </p>
            <img
              src="/assets/guides/download/curseforgeapp-modpack-properties-button.webp"
              alt="Createrington modpack page in CurseForge"
              className="mt-4 w-full rounded-lg border border-border bg-muted object-cover"
            />
          </>
        ),
      },
      {
        title: "Open Profile Options",
        description: "Access the modpack settings.",
        content: (
          <>
            <p>
              Click the <strong>three-dot menu</strong> next to the Play button
              and select <strong>Profile Options</strong>.
            </p>
            <img
              src="/assets/guides/download/curseforgeapp-profile-options-button.webp"
              alt="CurseForge three-dot menu with Profile Options highlighted"
              className="mt-4 w-full rounded-lg border border-border bg-muted object-cover"
            />
          </>
        ),
      },
      {
        title: "Allow Content Management",
        description: "Enable adding mods to the modpack.",
        content: (
          <>
            <p>
              In the Profile Options dialog, check the{" "}
              <strong>Allow content management for this profile</strong>{" "}
              checkbox under <strong>Content Management</strong>, then click{" "}
              <strong>Done</strong>.
            </p>
            <img
              src="/assets/guides/download/curseforge-app-profile-properties-content-management.webp"
              alt="CurseForge Profile Options with Allow content management checkbox"
              className="mt-4 w-full rounded-lg border border-border bg-muted object-cover"
            />
          </>
        ),
      },
      {
        title: "Add Content",
        description: "Browse and install mods.",
        content: (
          <>
            <p>
              Go back to the modpack page and click the{" "}
              <strong>+ Add Content</strong> button. Use the search bar to find
              the mod you want to add.
            </p>
            <img
              src="/assets/guides/download/curseforgeapp-add-content-button.webp"
              alt="CurseForge modpack page with Add Content button"
              className="mt-4 rounded-lg"
            />
            <p className="mt-4">
              Click <strong>Install</strong> next to the mod you want.
              CurseForge will automatically download it and any required
              dependencies.
            </p>
            <p className="mt-4">
              Make sure to only add <strong>client-side</strong> mods (e.g.
              shaders, minimaps, HUD tweaks). Server-side or incompatible mods
              will prevent you from joining the server.
            </p>
            <p className="mt-4">
              You can also remove mods you no longer want from the same menu.
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
              experience issues, remove the mod you added from the{" "}
              <strong>+ Add Content</strong> menu and try again.
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
        title: "Economy",
        description: "Manage your in-game money through Discord.",
        content: (
          <>
            <p>
              <CopyBlock label="Check balance" value="/money" />
            </p>
            <img
              src="/assets/guides/commands/money.webp"
              alt="/money command showing your balance"
              className="mt-4 w-full rounded-lg border border-border bg-muted object-cover"
            />
            <p className="mt-6">
              <CopyBlock label="Claim daily reward" value="/daily" />
            </p>
            <p className="mt-2">
              Claim a free reward once per day. The bot will show you when your
              next claim is available.
            </p>
            <img
              src="/assets/guides/commands/daily.webp"
              alt="/daily command showing reward claimed"
              className="mt-4 w-full rounded-lg border border-border bg-muted object-cover"
            />
            <p className="mt-6">
              <CopyBlock label="Send money" value="/pay @user [amount]" />
            </p>
            <p className="mt-2">
              Transfer money to another player. You can optionally add a note.
            </p>
            <img
              src="/assets/guides/commands/pay.webp"
              alt="/pay command showing transfer complete"
              className="mt-4 w-full rounded-lg border border-border bg-muted object-cover"
            />
            <p className="mt-6">
              <CopyBlock label="Transaction history" value="/history" />
            </p>
            <p className="mt-2">
              View your last 10 transactions — transfers, rewards, crypto
              trades, and more.
            </p>
            <img
              src="/assets/guides/commands/history.webp"
              alt="/history command showing transaction list"
              className="mt-4 w-full rounded-lg border border-border bg-muted object-cover"
            />
          </>
        ),
      },
      {
        title: "Player Info",
        description: "Check stats and compare with other players.",
        content: (
          <>
            <p>
              <CopyBlock label="Check playtime" value="/playtime" />
            </p>
            <p className="mt-2">
              See your total playtime, session count, and per-server breakdown.
              Mention another player to check theirs.
            </p>
            <img
              src="/assets/guides/commands/playtime.webp"
              alt="/playtime command showing playtime stats"
              className="mt-4 w-full rounded-lg border border-border bg-muted object-cover"
            />
            <p className="mt-6">
              <CopyBlock
                label="Compare players"
                value="/compare @player1 @player2"
              />
            </p>
            <p className="mt-2">
              Side-by-side comparison of balance, playtime, sessions, and join
              date between two players.
            </p>
            <img
              src="/assets/guides/commands/compare.webp"
              alt="/compare command showing player comparison"
              className="mt-4 w-full rounded-lg border border-border bg-muted object-cover"
            />
          </>
        ),
      },
    ],
  },
];
