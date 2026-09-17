import { useState } from "react";
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
import { FilterBar } from "@/features/admin/components/FilterBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  BarChart3,
  Blocks,
  Images,
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
import { PinnedTools } from "./components/PinnedTools";
import { ToolCard } from "./components/ToolCard";
import { MAX_PINNED_TOOLS, usePinnedTools } from "./hooks/use-pinned-tools";

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
    title: "Community",
    tools: [
      {
        title: "Gallery",
        description:
          "Review screenshots posted in Discord and publish them to the website gallery.",
        icon: Images,
        href: "/admin/tools/gallery",
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

const ALL_CATEGORY = "All";

const TOOLS = TOOL_SECTIONS.flatMap((section) =>
  section.tools.map((tool) => ({ ...tool, section: section.title })),
);

const TOOL_HREFS = TOOLS.map((tool) => tool.href);

const CATEGORIES = [
  { value: ALL_CATEGORY, count: TOOLS.length },
  ...TOOL_SECTIONS.map((section) => ({
    value: section.title,
    count: section.tools.length,
  })),
];

export function AdminTools() {
  const navigate = useNavigate();
  const toast = useToastActions();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(ALL_CATEGORY);
  const [pinned, togglePin] = usePinnedTools(TOOL_HREFS);

  const refetchMutation = trpc.admin.refetchDiscordEntities.useMutation({
    onSuccess: (data) => {
      toast.success(
        `Refreshed: ${data.roles} roles, ${data.channels} channels, ${data.categories} categories`,
      );
    },
    onError: (err) => toast.error(err.message),
  });

  const needle = query.trim().toLowerCase();
  const filtered = TOOLS.filter(
    (tool) =>
      (category === ALL_CATEGORY || tool.section === category) &&
      `${tool.title} ${tool.description}`.toLowerCase().includes(needle),
  );
  const pinnedTools = pinned.flatMap(
    (href) => TOOLS.find((tool) => tool.href === href) ?? [],
  );

  const handleTogglePin = (href: string) => {
    if (!togglePin(href)) {
      toast.info(`You can pin up to ${MAX_PINNED_TOOLS} tools`);
    }
  };

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

      <div className="mx-auto w-full max-w-[1400px] flex flex-1 flex-col gap-4 px-4 pb-4">
        <AdminPageTitle
          title="Tools"
          description="Operational utilities for Discord, the game servers, and the community."
        />

        {pinnedTools.length > 0 && (
          <PinnedTools tools={pinnedTools} onOpen={(href) => navigate(href)} />
        )}

        <Tabs value={category} onValueChange={setCategory} className="gap-4">
          <div className="overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <TabsList>
              {CATEGORIES.map(({ value, count }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="cursor-pointer text-foreground/80"
                >
                  {value}
                  <Badge
                    variant="outline"
                    className="border-transparent bg-foreground/10"
                  >
                    {count}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <FilterBar
            search={query}
            onSearchChange={setQuery}
            placeholder="Search tools..."
            activeCount={query.trim() ? 1 : 0}
          />

          <TabsContent value={category} tabIndex={-1}>
            {filtered.length > 0 ? (
              <div className="grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((tool) => (
                  <ToolCard
                    key={tool.href}
                    title={tool.title}
                    description={tool.description}
                    section={tool.section}
                    icon={tool.icon}
                    pinned={pinned.includes(tool.href)}
                    onOpen={() => navigate(tool.href)}
                    onTogglePin={() => handleTogglePin(tool.href)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No tools match “{query}”.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
