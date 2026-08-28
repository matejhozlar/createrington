import { useNavigate } from "react-router";
import type { LucideIcon } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { AdminPageTitle } from "@/features/admin/components/AdminPageTitle";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  BarChart3,
  Blocks,
  ChevronRight,
  Clock,
  Megaphone,
  MessageCircleQuestion,
  MessageSquare,
  Paintbrush,
  RefreshCw,
  Terminal,
  Timer,
  Users,
  Hammer as WorkshopIcon,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";

type Tool = {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
};

type ToolSection = {
  title: string;
  tools: Tool[];
};

const TOOL_SECTIONS: ToolSection[] = [
  {
    title: "Communication",
    tools: [
      {
        title: "Embed Builder",
        description:
          "Build Discord embeds with a live preview and save presets.",
        icon: Paintbrush,
        href: "/admin/tools/embed-builder",
      },
      {
        title: "Auto Messages",
        description: "Scheduled rotating messages sent to Discord channels.",
        icon: Timer,
        href: "/admin/tools/auto-messages",
      },
      {
        title: "Announcements",
        description: "Post maintenance notices to Discord.",
        icon: Megaphone,
        href: "/admin/tools/announcements",
      },
      {
        title: "FAQ Auto-Responder",
        description: "Keyword-triggered replies to common questions.",
        icon: MessageCircleQuestion,
        href: "/admin/tools/faq",
      },
      {
        title: "Player Prompts",
        description: "Ask players a question in Discord and collect responses.",
        icon: MessageSquare,
        href: "/admin/tools/prompts",
      },
    ],
  },
  {
    title: "Game Systems",
    tools: [
      {
        title: "Structure Packs",
        description: "Manage weekly rotating mod collections from CurseForge.",
        icon: Blocks,
        href: "/admin/tools/structure-packs",
      },
      {
        title: "Workshop",
        description:
          "Community mod suggestions: review, approve, and rule out mods.",
        icon: WorkshopIcon,
        href: "/admin/tools/workshop",
      },
      {
        title: "Parties",
        description:
          "Forceload chunks, ally status, members, and qualified players in one place.",
        icon: Users,
        href: "/admin/tools/parties",
      },
    ],
  },
  {
    title: "Moderation",
    tools: [
      {
        title: "Inactivity Management",
        description:
          "Track 60-day inactivity warnings and run the cleanup cycle.",
        icon: Clock,
        href: "/admin/tools/inactivity",
      },
    ],
  },
  {
    title: "Reference",
    tools: [
      {
        title: "Command Docs",
        description: "Auto-generated reference of all Discord slash commands.",
        icon: Terminal,
        href: "/admin/tools/command-docs",
      },
      {
        title: "Stat Search",
        description: "Search Minecraft stats across all players.",
        icon: BarChart3,
        href: "/admin/tools/stat-search",
      },
    ],
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
      <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border bg-sidebar px-4">
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

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => refetchMutation.mutate()}
              disabled={refetchMutation.isPending}
              aria-label="Refresh Discord data"
            >
              <RefreshCw
                className={`size-4 ${refetchMutation.isPending ? "animate-spin" : ""}`}
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Refresh Discord data</TooltipContent>
        </Tooltip>
      </header>

      <div className="mx-auto w-full max-w-[1000px] flex flex-1 flex-col gap-8 px-4 pb-4">
        <AdminPageTitle title="Tools" />

        {TOOL_SECTIONS.map((section) => (
          <section key={section.title} className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {section.title}
              </h2>
              <div className="h-px flex-1 bg-border" />
            </div>

            <ul className="flex flex-col rounded-lg border border-border bg-card">
              {section.tools.map((tool, index) => (
                <li key={tool.href}>
                  <button
                    type="button"
                    onClick={() => navigate(tool.href)}
                    className={`group flex w-full cursor-pointer items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-accent ${
                      index !== section.tools.length - 1
                        ? "border-b border-border"
                        : ""
                    }`}
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <tool.icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{tool.title}</div>
                      <div className="truncate text-sm text-muted-foreground">
                        {tool.description}
                      </div>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
