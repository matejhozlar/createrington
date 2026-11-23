import { addCustomModsGuide } from "./content/add-custom-mods";
import { discordCommandsGuide } from "./content/discord-commands";
import { importModpackGuide } from "./content/import-modpack";
import { installModpackGuide } from "./content/install-modpack";
import { updateModpackGuide } from "./content/update-modpack";
import type { Guide, GuideCategory } from "./types";

export const GUIDE_SECTIONS: { category: GuideCategory; title: string }[] = [
  { category: "getting-started", title: "Getting Started" },
  { category: "modpacks", title: "Modpacks" },
  { category: "discord", title: "Discord" },
];

export const guides: Guide[] = [
  installModpackGuide,
  updateModpackGuide,
  importModpackGuide,
  addCustomModsGuide,
  discordCommandsGuide,
];
