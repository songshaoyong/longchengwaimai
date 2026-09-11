import * as THREE from "three";
import { duskFactor, nightFactor } from "./period";

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("canvas");
  return { c, ctx };
}

function toTex(c: HTMLCanvasElement, repeat = false) {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  if (repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  }
  return tex;
}

export function makeFacadeMaps(rng: () => number) {
  const { c, ctx } = canvas(512, 1024);
  const { c: e, ctx: ectx } = canvas(512, 1024);
  const hue = 210 + rng() * 50;
  ctx.fillStyle = `hsl(${hue}, 14%, ${7 + rng() * 5}%)`;
  ctx.fillRect(0, 0, 512, 1024);
  ectx.fillStyle = "#000";
  ectx.fillRect(0, 0, 512, 1024);

  ctx.fillStyle = `hsl(${hue + 20}, 30%, 12%)`;
  ctx.fillRect(0, 820, 512, 204);
  ctx.fillStyle = `hsl(${320 + rng() * 40}, 70%, ${18 + rng() * 10}%)`;
  ctx.fillRect(0, 860, 512, 8);

  const cols = 5;
  const rows = 12;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const wx = 28 + x * 96;
      const wy = 24 + y * 66;
      ctx.fillStyle = "#0a0d14";
      ctx.fillRect(wx - 3, wy - 3, 78, 48);
      const on = rng() > 0.32;
      const warm = rng() > 0.48;
      if (on) {
        const a = 0.65 + rng() * 0.35;
        ctx.fillStyle = warm ? `rgba(255, ${188 + rng() * 40}, 96, ${a})` : `rgba(110, 210, 255, ${a})`;
        ectx.fillStyle = warm ? `rgb(255, ${160 + rng() * 40}, 70)` : `rgb(80, 200, 255)`;
      } else {
        ctx.fillStyle = "rgba(12, 16, 26, 0.95)";
        ectx.fillStyle = "#000";
      }
      ctx.fillRect(wx, wy, 72, 42);
      ectx.fillRect(wx, wy, 72, 42);
    }
  }

  ctx.fillStyle = "rgba(255,45,149,0.22)";
  ctx.fillRect(0, 0, 512, 14);
  ectx.fillStyle = "#3a1020";
  ectx.fillRect(0, 0, 512, 10);

  return { map: toTex(c), emissiveMap: toTex(e) };
}

export function makeRoadTexture() {
  const { c, ctx } = canvas(512, 512);
  ctx.fillStyle = "#12161e";
  ctx.fillRect(0, 0, 512, 512);
  ctx.fillStyle = "rgba(40, 70, 90, 0.08)";
  for (let i = 0; i < 80; i++) {
    ctx.fillRect(rng() * 512, rng() * 512, 8, 2);
  }
  ctx.strokeStyle = "rgba(230, 236, 245, 0.55)";
  ctx.setLineDash([28, 22]);
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(256, 0);
  ctx.lineTo(256, 512);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = "rgba(255, 196, 70, 0.35)";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(36, 0);
  ctx.lineTo(36, 512);
  ctx.moveTo(476, 0);
  ctx.lineTo(476, 512);
  ctx.stroke();
  ctx.fillStyle = "rgba(61, 240, 255, 0.06)";
  ctx.fillRect(0, 0, 512, 512);
  return toTex(c, true);
}

function rng() {
  return Math.random();
}

export function makeSidewalkTexture() {
  const { c, ctx } = canvas(256, 256);
  ctx.fillStyle = "#2a2422";
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 32, 0);
    ctx.lineTo(i * 32, 256);
    ctx.stroke();
  }
  return toTex(c, true);
}

/** 临街底商立面：暖黄橱窗 + 朴素招牌条 */
export function makeShopFrontMaps(rng: () => number) {
  const { c, ctx } = canvas(512, 256);
  const { c: e, ctx: ectx } = canvas(512, 256);
  ctx.fillStyle = `hsl(${28 + rng() * 20}, 18%, ${14 + rng() * 6}%)`;
  ctx.fillRect(0, 0, 512, 256);
  ectx.fillStyle = "#000";
  ectx.fillRect(0, 0, 512, 256);

  // 檐口 / 招牌底
  ctx.fillStyle = `hsl(${rng() > 0.5 ? 8 : 200}, 55%, ${22 + rng() * 10}%)`;
  ctx.fillRect(0, 0, 512, 48);
  ectx.fillStyle = `hsl(${rng() > 0.5 ? 20 : 190}, 80%, 40%)`;
  ectx.fillRect(0, 0, 512, 40);

  const units = 3 + Math.floor(rng() * 2);
  const unitW = 512 / units;
  for (let i = 0; i < units; i++) {
    const x = i * unitW + 10;
    const w = unitW - 20;
    // 门框
    ctx.fillStyle = "#0c1018";
    ctx.fillRect(x, 56, w, 180);
    // 玻璃橱窗（暖光）
    const warm = 180 + rng() * 50;
    const a = 0.75 + rng() * 0.2;
    ctx.fillStyle = `rgba(255, ${warm}, 110, ${a})`;
    ctx.fillRect(x + 8, 68, w - 16, 120);
    ectx.fillStyle = `rgb(255, ${warm - 20}, 90)`;
    ectx.fillRect(x + 8, 68, w - 16, 120);
    // 门
    ctx.fillStyle = `hsl(${30 + rng() * 15}, 25%, 22%)`;
    ctx.fillRect(x + w * 0.35, 120, w * 0.3, 110);
    // 卷帘半开
    if (rng() > 0.55) {
      ctx.fillStyle = "rgba(40, 50, 60, 0.55)";
      ctx.fillRect(x + 8, 68, w - 16, 28 + rng() * 40);
    }
  }
  return { map: toTex(c), emissiveMap: toTex(e) };
}

export function makeNeonSign(text: string, hue: number) {
  const { c, ctx } = canvas(768, 160);
  ctx.clearRect(0, 0, 768, 160);
  ctx.fillStyle = "rgba(4, 6, 12, 0.88)";
  ctx.fillRect(16, 18, 736, 124);
  ctx.strokeStyle = `hsl(${hue}, 100%, 62%)`;
  ctx.lineWidth = 4;
  ctx.strokeRect(22, 24, 724, 112);
  ctx.shadowColor = `hsl(${hue}, 100%, 60%)`;
  ctx.shadowBlur = 28;
  ctx.fillStyle = `hsl(${hue}, 100%, 78%)`;
  ctx.font = "bold 58px Microsoft YaHei, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 384, 80);
  ctx.shadowBlur = 0;
  const tex = toTex(c);
  tex.premultiplyAlpha = false;
  return tex;
}

const SKY_STARS = Array.from({ length: 180 }, () => ({
  x: Math.random() * 64,
  y: Math.random() * 480,
  a: 0.25 + Math.random() * 0.7,
}));

const DAY_SKY = ["#4aa4e0", "#8ec8f0", "#d2e8ff", "#eef6ff", "#ffe9c0", "#c5d4a4", "#9aab78"];
const DUSK_SKY = ["#1a1848", "#3a2868", "#8a3a58", "#ff6a3a", "#ff8a50", "#4a2030", "#201018"];
const NIGHT_SKY = ["#050614", "#0a0e28", "#1a1240", "#3a1848", "#ff6a4a", "#2a1020", "#07080e"];
const STOPS = [0, 0.38, 0.48, 0.52, 0.56, 0.62, 1];

function mixSky(day: string, dusk: string, night: string, wd: number, wdu: number, wn: number) {
  const a = new THREE.Color(day);
  const b = new THREE.Color(dusk);
  const n = new THREE.Color(night);
  return `#${new THREE.Color(a.r * wd + b.r * wdu + n.r * wn, a.g * wd + b.g * wdu + n.g * wn, a.b * wd + b.b * wdu + n.b * wn).getHexString()}`;
}

export function paintSky(tex: THREE.CanvasTexture, hour: number, raining: boolean) {
  const c = tex.image as HTMLCanvasElement;
  const ctx = c.getContext("2d");
  if (!ctx) return;
  const night = nightFactor(hour);
  const dusk = duskFactor(hour);
  const wNight = night * (1 - dusk * 0.35);
  const wDusk = dusk;
  const wDay = Math.max(0, 1 - wNight - wDusk);
  const g = ctx.createLinearGradient(0, 0, 0, c.height);
  for (let i = 0; i < STOPS.length; i++) {
    let hex = mixSky(DAY_SKY[i]!, DUSK_SKY[i]!, NIGHT_SKY[i]!, wDay, wDusk, wNight);
    if (raining) {
      const col = new THREE.Color(hex).lerp(new THREE.Color("#6a7380"), 0.35 + night * 0.1);
      hex = `#${col.getHexString()}`;
    }
    g.addColorStop(STOPS[i]!, hex);
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c.width, c.height);

  // 月亮:夜晚出现,固定位置(右上)
  if (night > 0.3 && !raining) {
    const mx = c.width * 0.78;
    const my = c.height * 0.18;
    const mr = 14;
    const moonAlpha = Math.min(1, (night - 0.3) / 0.5);
    // 月光晕
    const halo = ctx.createRadialGradient(mx, my, mr * 0.5, mx, my, mr * 4);
    halo.addColorStop(0, `rgba(255, 240, 220, ${0.25 * moonAlpha})`);
    halo.addColorStop(1, "rgba(255, 240, 220, 0)");
    ctx.fillStyle = halo;
    ctx.fillRect(mx - mr * 4, my - mr * 4, mr * 8, mr * 8);
    // 月亮本体
    ctx.fillStyle = `rgba(255, 245, 224, ${0.92 * moonAlpha})`;
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, Math.PI * 2);
    ctx.fill();
    // 月相阴影(右下偏,模拟半月)
    ctx.fillStyle = `rgba(20, 18, 38, ${0.35 * moonAlpha})`;
    ctx.beginPath();
    ctx.arc(mx + mr * 0.45, my + mr * 0.15, mr * 0.85, 0, Math.PI * 2);
    ctx.fill();
  }

  // 太阳:白天出现,固定位置(右上)
  if (night < 0.3 && !raining) {
    const sx = c.width * 0.78;
    const sy = c.height * 0.22;
    const sr = 18;
    const sunAlpha = Math.min(1, (0.3 - night) / 0.3);
    const halo = ctx.createRadialGradient(sx, sy, sr * 0.5, sx, sy, sr * 5);
    halo.addColorStop(0, `rgba(255, 240, 180, ${0.4 * sunAlpha})`);
    halo.addColorStop(1, "rgba(255, 240, 180, 0)");
    ctx.fillStyle = halo;
    ctx.fillRect(sx - sr * 5, sy - sr * 5, sr * 10, sr * 10);
    ctx.fillStyle = `rgba(255, 248, 210, ${0.9 * sunAlpha})`;
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
  }

  // 城市光污染:夜晚地平线橙色辉光带
  if (night > 0.2) {
    const glowAlpha = (night - 0.2) * 0.6;
    const glow = ctx.createLinearGradient(0, c.height * 0.82, 0, c.height);
    glow.addColorStop(0, `rgba(255, 140, 60, 0)`);
    glow.addColorStop(0.5, `rgba(255, 120, 50, ${0.18 * glowAlpha})`);
    glow.addColorStop(1, `rgba(255, 90, 40, ${0.32 * glowAlpha})`);
    ctx.fillStyle = glow;
    ctx.fillRect(0, c.height * 0.82, c.width, c.height * 0.18);
  }

  // 星星
  if (night > 0.35) {
    for (const s of SKY_STARS) {
      ctx.fillStyle = `rgba(230, 236, 255, ${s.a * (night - 0.3)})`;
      ctx.fillRect(s.x, s.y, 1, 1);
    }
  }
  tex.needsUpdate = true;
}

export function makeSkyTexture(hour = 10.5) {
  const { c } = canvas(64, 1024);
  const tex = toTex(c);
  paintSky(tex, hour, false);
  return tex;
}

export function makeLogoTexture() {
  const { c, ctx } = canvas(256, 256);
  ctx.fillStyle = "#ff6a1a";
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 140px Microsoft YaHei, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("龙", 128, 138);
  return toTex(c);
}

/** 程序化云层贴图:黑底 + 随机白色软团 */
export function makeCloudTexture() {
  const { c, ctx } = canvas(512, 512);
  ctx.fillStyle = "rgba(0,0,0,0)";
  ctx.clearRect(0, 0, 512, 512);
  for (let i = 0; i < 18; i++) {
    const x = rng() * 512;
    const y = rng() * 512;
    const r = 24 + rng() * 60;
    const alpha = 0.06 + rng() * 0.1;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
    g.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return toTex(c, true);
}
