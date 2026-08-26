import { type GuildMember, PermissionsBitField, type Role } from "discord.js";

function permissionsBeyond(
  granted: Readonly<PermissionsBitField>,
  baseline: Readonly<PermissionsBitField>,
): string[] {
  return new PermissionsBitField(
    granted.bitfield & ~baseline.bitfield,
  ).toArray();
}

export function getUnassignableReason(
  role: Role,
  me: GuildMember,
): string | null {
  const everyone = role.guild.roles.everyone;

  if (role.id === everyone.id) return "is the @everyone role";
  if (role.managed) return "is managed by an integration";

  const extra = permissionsBeyond(role.permissions, everyone.permissions);
  if (extra.length > 0) {
    return `grants permissions beyond @everyone (${extra.join(", ")})`;
  }

  for (const channel of role.guild.channels.cache.values()) {
    if (channel.isThread()) continue;

    const overwrite = channel.permissionOverwrites.cache.get(role.id);
    if (!overwrite) continue;

    const extraInChannel = permissionsBeyond(
      overwrite.allow,
      channel.permissionsFor(everyone),
    );
    if (extraInChannel.length > 0) {
      return `grants extra permissions in ${channel} (${extraInChannel.join(", ")})`;
    }
  }

  if (me.roles.highest.comparePositionTo(role) <= 0) {
    return "is at or above my highest role";
  }

  return null;
}
