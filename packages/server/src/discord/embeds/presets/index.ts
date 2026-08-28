import { AnnouncementEmbedPresets } from "./announcements";
import { CommandEmbedPresets } from "./commands";
import { CommonEmbedPresets } from "./common";
import { DepartedEmbedPresets } from "./departed";
import { FaqEmbedPresets } from "./faq";
import { GhostEmbedPresets } from "./ghost";
import { InactivityEmbedPresets } from "./inactivity";
import { ProgressEmbedPresets } from "./progress";
import { RegistrationEmbedPresets } from "./registration";
import { RoleAssignmentEmbedPresets } from "./role-assignment";
import { TicketEmbedPresets } from "./ticket";
import { WaitlistEmbedPresets } from "./waitlist";

/** Aggregated embed presets namespace: common presets are spread at the top level, domain presets are nested */
export const EmbedPresets = {
  ...CommonEmbedPresets,
  announcements: AnnouncementEmbedPresets,
  commands: CommandEmbedPresets,
  waitlist: WaitlistEmbedPresets,
  registration: RegistrationEmbedPresets,
  progress: ProgressEmbedPresets,
  ticket: TicketEmbedPresets,
  roleAssignment: RoleAssignmentEmbedPresets,
  departed: DepartedEmbedPresets,
  faq: FaqEmbedPresets,
  ghost: GhostEmbedPresets,
  inactivity: InactivityEmbedPresets,
};
