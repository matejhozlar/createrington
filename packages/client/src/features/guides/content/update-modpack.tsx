import { RefreshCw } from "lucide-react";
import { GuideImage } from "@/features/guides/components/GuideImage";
import type { Guide } from "@/features/guides/types";
import { openModpackStep } from "./open-modpack-step";

export const updateModpackGuide: Guide = {
  slug: "update-modpack",
  title: "Update the Modpack",
  description: "How to update the Createrington modpack to the latest version.",
  icon: RefreshCw,
  category: "getting-started",
  image: "/assets/guides/download/curseforgeapp-change-version-button.webp",
  imageIcon: RefreshCw,
  estimatedMinutes: 5,
  steps: [
    openModpackStep,
    {
      title: "Check Content Management",
      description: "Make sure content management is disabled.",
      content: (
        <>
          <p>
            Click the <strong>three-dot menu</strong> next to the Play button
            and select <strong>Profile Options</strong>.
          </p>
          <p className="mt-4">
            Make sure the{" "}
            <strong>Allow content management for this profile</strong> checkbox
            is <strong>unchecked</strong>. If it's checked, uncheck it and click{" "}
            <strong>Done</strong>.
          </p>
          <GuideImage
            src="/assets/guides/download/curseforgeapp-content-management.webp"
            alt="CurseForge Profile Options with content management disabled"
          />
          <p className="mt-4">
            The <strong>Change Version</strong> option only appears when content
            management is disabled. If you've added custom mods, you'll need to
            disable content management first, update, and then re-enable it.
          </p>
        </>
      ),
    },
    {
      title: "Change Version",
      description: "Select the latest modpack version.",
      content: (
        <>
          <p>
            Click the <strong>three-dot menu</strong> again — you'll now see{" "}
            <strong>Change Version</strong> at the top of the menu. Click it.
          </p>
          <GuideImage
            src="/assets/guides/download/curseforgeapp-change-version-button.webp"
            alt="CurseForge three-dot menu with Change Version option"
          />
          <p className="mt-4">
            Select the latest version from the list and confirm. CurseForge will
            download and apply the update automatically.
          </p>
        </>
      ),
    },
    {
      title: "Launch & Play",
      description: "Start the updated modpack.",
      content: (
        <p>
          Once the update is complete, click <strong>Play</strong> to launch the
          modpack with the latest version.
        </p>
      ),
    },
  ],
};
