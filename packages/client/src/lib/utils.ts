import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** True when running on the production deployment (createrington.com) */
export const isProduction =
  import.meta.env.VITE_API_URL === "https://createrington.com";
