import { AnnouncementComponentPresets } from "./announcements";
import { CommonComponentPresets } from "./common";
import { GalleryComponentPresets } from "./gallery";
import { ModpackChangelogComponentPresets } from "./modpack-changelog";

/** Aggregated Components V2 presets: common presets are spread at the top level, domain presets are nested */
export const ComponentPresets = {
  ...CommonComponentPresets,
  announcements: AnnouncementComponentPresets,
  gallery: GalleryComponentPresets,
  modpackChangelog: ModpackChangelogComponentPresets,
};
