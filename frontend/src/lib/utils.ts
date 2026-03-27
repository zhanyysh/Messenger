import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility function to cleanly merge tailwind classes with conditional clsx logic
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
