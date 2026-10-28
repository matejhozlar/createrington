import type { ComponentType, SVGProps } from "react";
import type { LauncherPlatform } from "@createrington/shared/launcher";
import { LinuxIcon } from "@/components/icons/linux";
import { WindowsIcon } from "@/components/icons/windows";

type LauncherPlatformDisplay = {
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

export const LAUNCHER_PLATFORM_DISPLAY: Record<
  LauncherPlatform,
  LauncherPlatformDisplay
> = {
  "windows-x86_64": { label: "Windows", icon: WindowsIcon },
  "linux-x86_64": { label: "Linux", icon: LinuxIcon },
};

export function launcherPlatformDisplay(
  platform: string,
): LauncherPlatformDisplay | undefined {
  return (
    LAUNCHER_PLATFORM_DISPLAY as Record<
      string,
      LauncherPlatformDisplay | undefined
    >
  )[platform];
}

export function launcherPlatformLabel(platform: string): string {
  return launcherPlatformDisplay(platform)?.label ?? platform;
}
