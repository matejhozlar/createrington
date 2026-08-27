export const MAINTENANCE_MOTD_PRESET =
  "&6&lCreaterington &8| &cUnder maintenance\n" +
  "&7Expected downtime: {eta}. Updates on Discord.";

export const MAINTENANCE_MESSAGE_PRESET =
  "&c&lMaintenance in progress\n\n" +
  "&7{server} is currently down for maintenance.\n" +
  "&7Expected downtime: {eta}. Check Discord for updates.";

export const MAINTENANCE_TEMPLATE_TOKENS = ["{server}", "{eta}"] as const;

export interface MaintenanceTemplateContext {
  server: string;
  estimatedMinutes: number | null;
}

export function formatEta(estimatedMinutes: number | null): string {
  if (estimatedMinutes === null || estimatedMinutes <= 0) return "unknown";
  if (estimatedMinutes < 60) return `~${estimatedMinutes} min`;
  const hours = Math.floor(estimatedMinutes / 60);
  const minutes = estimatedMinutes % 60;
  return minutes === 0 ? `~${hours}h` : `~${hours}h ${minutes}m`;
}

export function renderMaintenanceTemplate(
  template: string,
  context: MaintenanceTemplateContext,
): string {
  return template
    .replaceAll("{server}", context.server)
    .replaceAll("{eta}", formatEta(context.estimatedMinutes));
}
