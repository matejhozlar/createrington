import { useNavigate } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  Blocks,
  Coins,
  Megaphone,
  MessageCircleQuestion,
  Paintbrush,
  RefreshCw,
  Terminal,
  Timer,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";

const tools = [
  {
    title: "Structure Packs",
    description:
      "Manage weekly rotating structure packs. Create mod collections from CurseForge and configure the rotation schedule.",
    icon: Blocks,
    href: "/admin/tools/structure-packs",
  },
  {
    title: "FAQ Auto-Responder",
    description:
      "Manage keyword-triggered FAQ entries that automatically respond to common questions in Discord.",
    icon: MessageCircleQuestion,
    href: "/admin/tools/faq",
  },
  {
    title: "Embed Builder",
    description:
      "Visually build Discord embeds with a live preview and send them to any channel. Save and load presets.",
    icon: Paintbrush,
    href: "/admin/tools/embed-builder",
  },
  {
    title: "Auto Messages",
    description:
      "Configure scheduled rotating messages sent to Discord channels on a timer.",
    icon: Timer,
    href: "/admin/tools/auto-messages",
  },
  {
    title: "Announcements",
    description:
      "Send modpack changelogs and maintenance announcements to the Discord announcements channel.",
    icon: Megaphone,
    href: "/admin/tools/announcements",
  },
  {
    title: "Crypto Market",
    description:
      "Manage tokens, trigger market events, view treasury stats, and monitor the in-game crypto economy.",
    icon: Coins,
    href: "/admin/tools/crypto",
  },
  {
    title: "Command Docs",
    description:
      "Auto-generated reference of all Discord slash commands with options, permissions, and cooldowns.",
    icon: Terminal,
    href: "/admin/tools/command-docs",
  },
];

export function AdminTools() {
  const navigate = useNavigate();
  const toast = useToastActions();

  const refetchMutation = trpc.admin.refetchDiscordEntities.useMutation({
    onSuccess: (data) => {
      toast.success(
        `Refreshed: ${data.roles} roles, ${data.channels} channels, ${data.categories} categories`,
      );
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="flex flex-1 flex-col gap-4">
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border bg-sidebar px-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin/dashboard">Admin</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Tools</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <div className="flex flex-1 flex-col gap-4 px-4 pb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Tools</h1>
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={() => refetchMutation.mutate()}
            disabled={refetchMutation.isPending}
          >
            <RefreshCw
              className={`mr-2 size-4 ${refetchMutation.isPending ? "animate-spin" : ""}`}
            />
            Refresh Discord Data
          </Button>
        </div>

        <div className="grid auto-rows-fr gap-4 sm:grid-cols-2">
          {tools.map((tool) => (
            <button
              key={tool.href}
              type="button"
              onClick={() => navigate(tool.href)}
              className="group cursor-pointer rounded-lg border border-border bg-card p-6 text-left transition-colors hover:bg-accent"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <tool.icon className="size-5" />
                </div>
                <h2 className="text-lg font-semibold">{tool.title}</h2>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {tool.description}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
