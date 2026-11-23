import { FolderInput, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { GuideImage } from "@/features/guides/components/GuideImage";
import type { Guide } from "@/features/guides/types";

export const importModpackGuide: Guide = {
  slug: "import-modpack",
  title: "How to Import Modpacks",
  description:
    "Import a modpack manually into CurseForge from a downloaded file.",
  icon: FolderInput,
  category: "modpacks",
  image: "/assets/guides/download/curseforge-hero.webp",
  imageIcon: "/assets/logo/curseforge.webp",
  estimatedMinutes: 5,
  steps: [
    {
      title: "Get the Modpack File",
      description: "Download the .zip file you want to import.",
      content: (
        <>
          <p>
            If you received a modpack as a <strong>.zip</strong> file from our
            team (e.g. via Discord or a direct download link), save it somewhere
            you can easily find it.
          </p>
          <Alert className="mt-4 border-amber-900 bg-amber-950 text-amber-50">
            <TriangleAlert />
            <AlertTitle>Safety Warning</AlertTitle>
            <AlertDescription>
              Only import modpack files from sources you trust. Files from
              unknown sources could contain malicious content. We recommend only
              using files provided by our team.
            </AlertDescription>
          </Alert>
        </>
      ),
    },
    {
      title: "Click Import",
      description: "Open the import dialog in CurseForge.",
      content: (
        <>
          <p>
            Open the CurseForge app, go to the <strong>Minecraft</strong>{" "}
            section, and click the <strong>Import</strong> button at the top.
          </p>
          <GuideImage
            src="/assets/guides/download/curseforgeapp-import-button.webp"
            alt="CurseForge app with Import button highlighted"
          />
        </>
      ),
    },
    {
      title: "Import the Modpack",
      description: "Use a .zip file or a profile code.",
      content: (
        <>
          <p>In the Import Profile dialog, you'll see two options:</p>
          <GuideImage
            src="/assets/guides/download/curseforgeapp-import-menu.webp"
            alt="CurseForge import profile dialog"
          />
          <ul className="list-disc pl-6 space-y-1 mt-4">
            <li>
              <strong>Import Profile .zip</strong> — click{" "}
              <strong>Choose .zip file</strong> and select the modpack file you
              downloaded
            </li>
            <li>
              <strong>Use Profile Code</strong> — if you received a code
              instead, paste it into the text field and click{" "}
              <strong>Import</strong>. Codes are valid for 7 days
            </li>
          </ul>
          <p className="mt-4">
            CurseForge will extract and install the modpack automatically.
          </p>
        </>
      ),
    },
    {
      title: "Launch & Play",
      description: "Start the imported modpack.",
      content: (
        <p>
          Once the import is complete, the modpack will appear in your{" "}
          <strong>My Modpacks</strong> list. Click <strong>Play</strong> to
          launch it.
        </p>
      ),
    },
  ],
};
