import { Pickaxe, Play, Sword, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

import {
  MinecraftButton,
  type MinecraftButtonSize,
  type MinecraftButtonVariant,
} from "./MinecraftButton";

const VARIANTS: { variant: MinecraftButtonVariant; label: string }[] = [
  { variant: "stone", label: "Stone" },
  { variant: "obsidian", label: "Obsidian" },
  { variant: "gold", label: "Gold" },
  { variant: "grass", label: "Grass" },
  { variant: "tnt", label: "TNT" },
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
          <MinecraftButton key={size} variant="gold" size={size}>
            {size}
          </MinecraftButton>
        ))}
      </Section>

      <Section title="With icons">
        <MinecraftButton variant="grass">
          <Play />
          Play Now
        </MinecraftButton>
        <MinecraftButton variant="stone">
          <Pickaxe />
          Mine
        </MinecraftButton>
        <MinecraftButton variant="gold">
          <Sword />
          Attack
        </MinecraftButton>
        <MinecraftButton variant="tnt">
          <Trash2 />
          Delete
        </MinecraftButton>
      </Section>

      <Section title="Disabled">
        <MinecraftButton variant="stone" disabled>
          Locked
        </MinecraftButton>
        <MinecraftButton variant="gold" disabled>
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
