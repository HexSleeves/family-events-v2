import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatEventPrice(price: number | null, isFree: boolean): string {
  if (isFree) return "Free"
  if (price == null) return "See details"
  return `$${price}`
}
