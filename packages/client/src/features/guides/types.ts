import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export type GuideStep = {
  title: string;
  description: string;
  content: ReactNode;
};

export type GuideCategory = "getting-started" | "modpacks" | "discord";

export type Guide = {
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
