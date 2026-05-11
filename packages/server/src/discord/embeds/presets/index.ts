import { AnnouncementEmbedPresets } from "./announcements";
import { CommandEmbedPresets } from "./commands";
import { CommonEmbedPresets } from "./common";
import { ConfirmationEmbedPresets } from "./confirmation";
import { CryptoEmbedPresets } from "./crypto";
import { DepartedEmbedPresets } from "./departed";
import { FaqEmbedPresets } from "./faq";
import { InactivityEmbedPresets } from "./inactivity";
import { LeaderboardEmbedPresets } from "./leaderboard";
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
  crypto: CryptoEmbedPresets,
  waitlist: WaitlistEmbedPresets,
  registration: RegistrationEmbedPresets,
  confirmation: ConfirmationEmbedPresets,
  progress: ProgressEmbedPresets,
  ticket: TicketEmbedPresets,
  leaderboard: LeaderboardEmbedPresets,
  roleAssignment: RoleAssignmentEmbedPresets,
  departed: DepartedEmbedPresets,
  faq: FaqEmbedPresets,
  inactivity: InactivityEmbedPresets,
};
