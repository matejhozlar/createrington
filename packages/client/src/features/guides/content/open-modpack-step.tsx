import { GuideImage } from "@/features/guides/components/GuideImage";
import type { GuideStep } from "@/features/guides/types";

export const openModpackStep: GuideStep = {
  title: "Open the Createrington modpack",
  description: "Find the modpack in CurseForge.",
  content: (
    <>
      <p>
        In the CurseForge app, go to <strong>My Modpacks</strong> and click on{" "}
        <strong>Createrington</strong>.
      </p>
      <GuideImage
        src="/assets/guides/download/curseforgeapp-modpack-properties-button.webp"
        alt="Createrington modpack page in CurseForge"
      />
    </>
  ),
};
