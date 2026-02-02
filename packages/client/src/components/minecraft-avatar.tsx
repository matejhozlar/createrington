"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface MinecraftAvatarProps {
  username: string;
  uuid?: string;
  size?: number;
  className?: string;
}

export function MinecraftAvatar({
  username,
  uuid,
  size = 32,
  className = "",
}: MinecraftAvatarProps) {
  const avatarUrl = uuid ? `https://mc-heads.net/avatar/${uuid}` : undefined;

  const avatarFallbackLetter = username.trim().charAt(0).toUpperCase();

  return (
    <Avatar
      className={`rounded-xs ${className}`}
      style={{ width: size, height: size }}
    >
      <AvatarImage src={avatarUrl} alt={username} />

      <AvatarFallback className="rounded-lg">
        {avatarFallbackLetter}
      </AvatarFallback>
    </Avatar>
  );
}
