import { AnnouncementComponentPresets } from "./announcements";
import { AppReleaseComponentPresets } from "./app-release";
import { CommonComponentPresets } from "./common";
import { GalleryComponentPresets } from "./gallery";
import { HallOfFameComponentPresets } from "./hall-of-fame";
import { ModpackChangelogComponentPresets } from "./modpack-changelog";

export const ComponentPresets = {
  ...CommonComponentPresets,
  announcements: AnnouncementComponentPresets,
  appRelease: AppReleaseComponentPresets,
  gallery: GalleryComponentPresets,
  hallOfFame: HallOfFameComponentPresets,
  modpackChangelog: ModpackChangelogComponentPresets,
};
