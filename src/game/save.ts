import type { PlayerStats } from "./types";
import { defaultStoryProgress, type StoryProgress } from "../data/stories";

export const SAVE_KEY = "dce-save-v1";

export type SaveData = {
  version: 1;
  name: string;
  money: number;
  goodReviews: number;
  deliveries: number;
  bestCombo: number;
  tutorialDone: boolean;
  muted: boolean;
  minutes: number;
  storyProgress: StoryProgress;
};

export function defaultSave(name = "阿龙"): SaveData {
  return {
    version: 1,
    name,
    money: 0,
    goodReviews: 0,
    deliveries: 0,
    bestCombo: 0,
    tutorialDone: false,
    muted: false,
    minutes: 10 * 60 + 20,
    storyProgress: defaultStoryProgress(),
  };
}

export function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<SaveData>;
    if (data.version !== 1) return null;
    return {
      ...defaultSave(),
      ...data,
      storyProgress: { ...defaultStoryProgress(), ...(data.storyProgress ?? {}) },
    };
  } catch {
    return null;
  }
}

export function writeSave(data: SaveData) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

export function clearSave() {
  localStorage.removeItem(SAVE_KEY);
}

export function snapshot(
  stats: PlayerStats,
  extra: Pick<SaveData, "tutorialDone" | "muted" | "minutes" | "storyProgress">,
): SaveData {
  return {
    version: 1,
    name: stats.name,
    money: stats.money,
    goodReviews: stats.goodReviews,
    deliveries: stats.deliveries,
    bestCombo: stats.bestCombo,
    tutorialDone: extra.tutorialDone,
    muted: extra.muted,
    minutes: extra.minutes,
    storyProgress: { ...extra.storyProgress },
  };
}
