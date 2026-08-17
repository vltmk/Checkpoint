import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combine Tailwind classes with clsx and twMerge
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
