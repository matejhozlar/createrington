import { useNavigate } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import {
  Coins,
  MessageCircleQuestion,
  Package,
  Paintbrush,
  Timer,
} from "lucide-react";

const tools = [
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
    title: "Modpack Changelog",
    description:
      "Compose and send modpack update changelogs to the Discord notifications channel.",
    icon: Package,
    href: "/admin/tools/changelog",
  },
  {
    title: "Crypto Market",
    description:
      "Manage tokens, trigger market events, view treasury stats, and monitor the in-game crypto economy.",
    icon: Coins,
    href: "/admin/tools/crypto",
  },
];

export function AdminTools() {
  const navigate = useNavigate();

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
        <h1 className="text-2xl font-semibold">Tools</h1>

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
