export const LOADER_NAMES: Record<number, string> = {
  1: "Forge",
  4: "Fabric",
  5: "Quilt",
  6: "NeoForge",
};

export function loaderName(loaderType: number): string {
  return LOADER_NAMES[loaderType] ?? `Loader ${loaderType}`;
}

export function formatDownloads(count: number): string {
  if (count >= 1_000_000_000) return `${(count / 1_000_000_000).toFixed(1)}B`;
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

export function toDatetimeLocalInput(value: string | Date | null): string {
  if (!value) return "";
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDate(value: string | Date | null): string {
  if (!value) return "Unknown";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function modCredit(source: string, submitterName: string | null) {
  const isAdmin = source === "admin";
  return {
    isAdmin,
    verb: isAdmin ? "Added by" : "Suggested by",
    name: submitterName ?? (isAdmin ? "an admin" : "a player"),
  };
}

export const MOD_STATUS_STYLES: Record<
  string,
  { label: string; className: string }
> = {
  approved: {
    label: "Approved",
    className: "border-green-500/50 bg-green-500/10 text-green-400",
  },
  pending: {
    label: "Pending review",
    className: "border-yellow-500/50 bg-yellow-500/10 text-yellow-400",
  },
  declined: {
    label: "Declined",
    className: "border-zinc-500/50 bg-zinc-500/10 text-zinc-400",
  },
  rejected: {
    label: "Rejected",
    className: "border-red-500/50 bg-red-500/10 text-red-400",
  },
};
