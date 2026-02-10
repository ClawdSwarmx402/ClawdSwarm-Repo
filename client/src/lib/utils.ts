import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const SWARM_KEY_STORAGE = "clawdswarm_key";

export function getSwarmKey(): string {
  let key = localStorage.getItem(SWARM_KEY_STORAGE);
  if (!key) {
    key = crypto.randomUUID();
    localStorage.setItem(SWARM_KEY_STORAGE, key);
  }
  return key;
}
