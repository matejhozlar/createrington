import { Puzzle } from "lucide-react";
import { GuideImage } from "@/features/guides/components/GuideImage";
import type { Guide } from "@/features/guides/types";
import { openModpackStep } from "./open-modpack-step";

export const addCustomModsGuide: Guide = {
  slug: "add-custom-mods",
  title: "How to Add Custom Mods",
  description: "Add extra mods to your modpack installation in CurseForge.",
  icon: Puzzle,
  category: "modpacks",
  image: "/assets/features/modpack.webp",
  imageIcon: "/assets/features/cogwheel.webp",
  estimatedMinutes: 5,
  steps: [
    openModpackStep,
    {
      title: "Open Profile Options",
      description: "Access the modpack settings.",
      content: (
        <>
          <p>
            Click the <strong>three-dot menu</strong> next to the Play button
            and select <strong>Profile Options</strong>.
          </p>
          <GuideImage
            src="/assets/guides/download/curseforgeapp-profile-options-button.webp"
            alt="CurseForge three-dot menu with Profile Options highlighted"
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
            <strong>Allow content management for this profile</strong> checkbox
            under <strong>Content Management</strong>, then click{" "}
            <strong>Done</strong>.
          </p>
          <GuideImage
            src="/assets/guides/download/curseforge-app-profile-properties-content-management.webp"
            alt="CurseForge Profile Options with Allow content management checkbox"
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
          <GuideImage
            bare
            src="/assets/guides/download/curseforgeapp-add-content-button.webp"
            alt="CurseForge modpack page with Add Content button"
          />
          <p className="mt-4">
            Click <strong>Install</strong> next to the mod you want. CurseForge
            will automatically download it and any required dependencies.
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
        <p>
          Launch the modpack to verify the new mod loads correctly. If you
          experience issues, remove the mod you added from the{" "}
          <strong>+ Add Content</strong> menu and try again.
        </p>
      ),
    },
  ],
};
