import { Download, Play, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

import {
  MinecraftButton,
  type MinecraftButtonSize,
  type MinecraftButtonVariant,
} from "./MinecraftButton";

const VARIANTS: { variant: MinecraftButtonVariant; label: string }[] = [
  { variant: "default", label: "Default" },
  { variant: "secondary", label: "Secondary" },
  { variant: "outline", label: "Outline" },
  { variant: "destructive", label: "Destructive" },
  { variant: "success", label: "Success" },
  { variant: "discord", label: "Discord" },
];

const SIZES: MinecraftButtonSize[] = ["sm", "default", "lg"];

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h2 className="font-minecraft text-lg text-primary">{title}</h2>
      <div className="flex flex-wrap items-center gap-4">{children}</div>
    </section>
  );
}

export function MinecraftButtonsDemo() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-12 p-8">
      <header className="space-y-2">
        <h1 className="font-minecraft text-2xl text-foreground">
          Minecraft Buttons
        </h1>
        <p className="text-sm text-muted-foreground">
          Experimental block-style buttons: flat faces with a bright inner ring,
          a hard drop-shadow base, and a press-down hover. Standalone preview
          before deciding whether to adopt them site-wide.
        </p>
      </header>

      <Section title="Variants">
        {VARIANTS.map(({ variant, label }) => (
          <MinecraftButton key={variant} variant={variant}>
            {label}
          </MinecraftButton>
        ))}
      </Section>

      <Section title="Sizes">
        {SIZES.map((size) => (
          <MinecraftButton key={size} size={size}>
            {size}
          </MinecraftButton>
        ))}
      </Section>

      <Section title="With icons">
        <MinecraftButton>
          <Download />
          Download
        </MinecraftButton>
        <MinecraftButton variant="outline">
          <Play />
          Learn More
        </MinecraftButton>
        <MinecraftButton variant="destructive">
          <Trash2 />
          Delete
        </MinecraftButton>
      </Section>

      <Section title="Disabled">
        <MinecraftButton disabled>Locked</MinecraftButton>
        <MinecraftButton variant="secondary" disabled>
          Locked
        </MinecraftButton>
      </Section>

      <Section title="Current site button (for comparison)">
        <Button>Default</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="destructive">Destructive</Button>
      </Section>
    </div>
  );
}
