export type NavTone = "destructive" | "amber";

export const NAV_TONES: Record<
  NavTone,
  {
    text: string;
    trigger: string;
    subActive: string;
    collapsed: string;
    active: string;
  }
> = {
  destructive: {
    text: "text-destructive",
    trigger: "text-destructive hover:text-destructive hover:bg-destructive/10",
    subActive: "text-destructive bg-destructive/10",
    collapsed: "text-destructive hover:bg-destructive/10",
    active: "bg-destructive/20 font-medium",
  },
  amber: {
    text: "text-amber-500",
    trigger: "text-amber-500 hover:text-amber-500 hover:bg-amber-500/10",
    subActive: "text-amber-500 bg-amber-500/10",
    collapsed: "text-amber-500 hover:bg-amber-500/10",
    active: "bg-amber-500/20 font-medium",
  },
};

export const NAV_COLLAPSED_ITEM_CLASS =
  "flex size-8 items-center justify-center rounded-md transition-colors";
