import { AnnouncementComponentPresets } from "./announcements";
import { CommonComponentPresets } from "./common";
import { ModpackChangelogComponentPresets } from "./modpack-changelog";

/** Aggregated Components V2 presets: common presets are spread at the top level, domain presets are nested */
export const ComponentPresets = {
  ...CommonComponentPresets,
  announcements: AnnouncementComponentPresets,
  modpackChangelog: ModpackChangelogComponentPresets,
};
