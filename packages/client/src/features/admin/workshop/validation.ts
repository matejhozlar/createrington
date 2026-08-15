export function workshopFormError(fields: {
  maxMods: string;
  maxUpvotes: string;
  basePackId: string;
  forumChannelId: string;
  publishedPackId?: string;
}): string | null {
  const maxMods = Number(fields.maxMods);
  if (!Number.isInteger(maxMods) || maxMods < 1 || maxMods > 25) {
    return "Suggestions per player must be between 1 and 25";
  }
  const maxUpvotes = Number(fields.maxUpvotes);
  if (!Number.isInteger(maxUpvotes) || maxUpvotes < 1 || maxUpvotes > 100) {
    return "Upvotes per player must be between 1 and 100";
  }
  const basePackId = fields.basePackId.trim();
  if (
    basePackId &&
    (!Number.isInteger(Number(basePackId)) || Number(basePackId) <= 0)
  ) {
    return "Base modpack ID must be a positive number";
  }
  const publishedPackError = modpackFormError(fields.publishedPackId ?? "");
  if (publishedPackError) return publishedPackError;
  const forumChannelId = fields.forumChannelId.trim();
  if (forumChannelId && !/^\d{17,20}$/.test(forumChannelId)) {
    return "Discord forum channel ID must be a 17-20 digit number";
  }
  return null;
}

export function modpackFormError(publishedPackId: string): string | null {
  const trimmed = publishedPackId.trim();
  if (trimmed && (!Number.isInteger(Number(trimmed)) || Number(trimmed) <= 0)) {
    return "Published modpack project ID must be a positive number";
  }
  return null;
}
