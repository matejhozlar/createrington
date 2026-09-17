import { AnnouncementComponentPresets } from "./announcements";
import { CommonComponentPresets } from "./common";
import { GalleryComponentPresets } from "./gallery";
import { HallOfFameComponentPresets } from "./hall-of-fame";
import { ModpackChangelogComponentPresets } from "./modpack-changelog";

/** Aggregated Components V2 presets: common presets are spread at the top level, domain presets are nested */
export const ComponentPresets = {
  ...CommonComponentPresets,
  announcements: AnnouncementComponentPresets,
  gallery: GalleryComponentPresets,
  hallOfFame: HallOfFameComponentPresets,
  modpackChangelog: ModpackChangelogComponentPresets,
};
