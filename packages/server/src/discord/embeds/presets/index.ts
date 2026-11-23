import { AnnouncementEmbedPresets } from "./announcements";
import { BanEmbedPresets } from "./bans";
import { CommandEmbedPresets } from "./commands";
import { CommonEmbedPresets } from "./common";
import { DepartedEmbedPresets } from "./departed";
import { FaqEmbedPresets } from "./faq";
import { GalleryEmbedPresets } from "./gallery";
import { GhostEmbedPresets } from "./ghost";
import { InactivityEmbedPresets } from "./inactivity";
import { RegistrationEmbedPresets } from "./registration";
import { TicketEmbedPresets } from "./ticket";
import { WaitlistEmbedPresets } from "./waitlist";

export const EmbedPresets = {
  ...CommonEmbedPresets,
  announcements: AnnouncementEmbedPresets,
  bans: BanEmbedPresets,
  commands: CommandEmbedPresets,
  waitlist: WaitlistEmbedPresets,
  registration: RegistrationEmbedPresets,
  ticket: TicketEmbedPresets,
  departed: DepartedEmbedPresets,
  faq: FaqEmbedPresets,
  gallery: GalleryEmbedPresets,
  ghost: GhostEmbedPresets,
  inactivity: InactivityEmbedPresets,
};
