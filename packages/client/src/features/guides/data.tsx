import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Download, MessageSquare, Compass } from "lucide-react";
import { CopyBlock } from "./components/CopyBlock";

type GuideStep = {
  title: string;
  description: string;
  content: ReactNode;
};

type Guide = {
  slug: string;
  title: string;
  description: string;
  icon: LucideIcon;
  difficulty: "beginner" | "intermediate" | "advanced";
  estimatedMinutes: number;
  steps: GuideStep[];
};

export type { Guide, GuideStep };

export const guides: Guide[] = [
  {
    slug: "download-install",
    title: "Download & Install",
    description:
      "Get the modpack installed and connect to the server for the first time.",
    icon: Download,
    difficulty: "beginner",
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
                <strong>At least 4 GB of RAM</strong> allocated to Minecraft
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
        title: "Download Launcher",
        description: "Download and install the modpack launcher.",
        content: (
          <>
            <p>
              We recommend using <strong>Prism Launcher</strong> or the{" "}
              <strong>CurseForge App</strong> to manage your modpack
              installation.
            </p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Download your preferred launcher from its official website</li>
              <li>Install it and sign in with your Minecraft account</li>
            </ul>
          </>
        ),
      },
      {
        title: "Install Modpack",
        description: "Add the Createrington modpack to your launcher.",
        content: (
          <>
            <p>
              Search for <strong>Createrington</strong> in your launcher's
              modpack browser, then click <strong>Install</strong>.
            </p>
            <p className="mt-2">
              The modpack will automatically download all required mods and
              configure the correct Minecraft version.
            </p>
          </>
        ),
      },
      {
        title: "Configure Settings",
        description: "Optimize your game settings for the best experience.",
        content: (
          <>
            <p>Before connecting, we recommend adjusting these settings:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>
                <strong>RAM allocation:</strong> set to 4–6 GB in your launcher
                settings
              </li>
              <li>
                <strong>Render distance:</strong> 8–12 chunks for best
                performance
              </li>
              <li>
                <strong>Shaders:</strong> optional — disable if you experience
                lag
              </li>
            </ul>
          </>
        ),
      },
      {
        title: "Connect to Server",
        description: "Join the Createrington server.",
        content: (
          <>
            <p>Add the server to your Minecraft server list:</p>
            <div className="mt-3">
              <CopyBlock label="Server Address" value="play.create-rington.com" />
            </div>
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
    slug: "discord-commands",
    title: "Discord Commands",
    description:
      "Learn the most useful Discord bot commands for the server.",
    icon: MessageSquare,
    difficulty: "beginner",
    estimatedMinutes: 5,
    steps: [
      {
        title: "Getting Started",
        description: "How to use commands in Discord.",
        content: (
          <>
            <p>
              All bot commands use Discord's <strong>slash command</strong>{" "}
              system. Type <code className="bg-muted px-1.5 py-0.5 rounded text-sm">/</code>{" "}
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
  {
    slug: "getting-started",
    title: "Getting Started",
    description:
      "Your first steps on the server — key locations, basic mechanics, and helpful tips.",
    icon: Compass,
    difficulty: "beginner",
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
];
