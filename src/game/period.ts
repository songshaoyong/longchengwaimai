import { clamp } from "./rng";

function smoothstep(e0: number, e1: number, x: number) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** 0 = 白昼，1 = 深夜 */
export function nightFactor(hour: number) {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 7.6 && h < 16.4) return 0;
  if (h >= 16.4 && h < 19.1) return smoothstep(16.4, 19.1, h);
  if (h >= 5.4 && h < 7.6) return 1 - smoothstep(5.4, 7.6, h);
  return 1;
}

/** 清晨 / 黄昏暖色带 */
export function duskFactor(hour: number) {
  const h = ((hour % 24) + 24) % 24;
  const dusk = h >= 16 && h < 19.4 ? 1 - Math.abs(h - 17.7) / 1.7 : 0;
  const dawn = h >= 5.2 && h < 8 ? 1 - Math.abs(h - 6.5) / 1.4 : 0;
  return clamp(Math.max(dusk, dawn), 0, 1);
}

export function periodName(hour: number) {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 5.4 && h < 8) return "清晨";
  if (h >= 8 && h < 12) return "上午";
  if (h >= 12 && h < 16.4) return "午后";
  if (h >= 16.4 && h < 19.2) return "黄昏";
  return "夜晚";
}
