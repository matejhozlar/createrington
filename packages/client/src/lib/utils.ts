import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function numberToHex(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}
