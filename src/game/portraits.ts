import * as THREE from "three";

/** 程序化 NPC 立绘贴图:Canvas 画的简单头像 */
export function makeNpcTexture(id: "ma" | "longshu" | "lin" | "alin") {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("canvas");

  // 透明背景
  ctx.clearRect(0, 0, 256, 256);

  // 圆形遮罩 + 头像
  const cx = 128;
  const cy = 140;
  const r = 100;

  // 不同 NPC 的配色 + 特征
  const palette: Record<string, { bg: string; skin: string; hair: string; acc: string; name: string; tag: string }> = {
    ma: {
      bg: "#1a2430",
      skin: "#d8a878",
      hair: "#3a3a40",
      acc: "#ff6a1a",
      name: "老马",
      tag: "退休骑手",
    },
    longshu: {
      bg: "#1a2830",
      skin: "#d4c0a0",
      hair: "#9090a0",
      acc: "#3df0ff",
      name: "龙叔",
      tag: "独居老人",
    },
    lin: {
      bg: "#2a1830",
      skin: "#e0c0a0",
      hair: "#1a1a20",
      acc: "#ff2d95",
      name: "林小姐",
      tag: "加班白领",
    },
    alin: {
      bg: "#1a3028",
      skin: "#d8b888",
      hair: "#2a2010",
      acc: "#7dffb3",
      name: "阿琳",
      tag: "同行女骑手",
    },
  };
  const p = palette[id]!;

  // 背景圆
  const grad = ctx.createRadialGradient(cx, cy - 30, r * 0.3, cx, cy, r);
  grad.addColorStop(0, p.bg);
  grad.addColorStop(1, "#050810");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // 描边
  ctx.strokeStyle = p.acc;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  // 头发(简化)
  ctx.fillStyle = p.hair;
  if (id === "ma") {
    // 老马:平头 + 胡茬
    ctx.fillRect(cx - 50, cy - 70, 100, 28);
    // 胡茬
    ctx.fillStyle = p.hair;
    ctx.fillRect(cx - 25, cy + 18, 50, 12);
  } else if (id === "longshu") {
    // 龙叔:秃顶 + 白发圈
    ctx.beginPath();
    ctx.arc(cx, cy - 30, 55, Math.PI, 2 * Math.PI);
    ctx.fill();
    ctx.fillRect(cx - 60, cy - 30, 120, 18);
  } else if (id === "lin") {
    // 林小姐:齐肩短发
    ctx.fillRect(cx - 55, cy - 70, 110, 50);
    ctx.fillRect(cx - 55, cy - 35, 18, 70);
    ctx.fillRect(cx + 37, cy - 35, 18, 70);
  } else {
    // 阿琳:马尾
    ctx.fillRect(cx - 50, cy - 70, 100, 30);
    ctx.fillRect(cx + 35, cy - 55, 24, 80);
  }

  // 脸
  ctx.fillStyle = p.skin;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 45, 55, 0, 0, Math.PI * 2);
  ctx.fill();

  // 眼睛
  ctx.fillStyle = "#1a1a20";
  if (id === "lin" || id === "alin") {
    // 女性:细眉眼
    ctx.fillRect(cx - 18, cy - 6, 10, 3);
    ctx.fillRect(cx + 8, cy - 6, 10, 3);
  } else {
    ctx.beginPath();
    ctx.arc(cx - 14, cy - 4, 3, 0, Math.PI * 2);
    ctx.arc(cx + 14, cy - 4, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // 嘴
  ctx.strokeStyle = "#5a3030";
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (id === "ma" || id === "longshu") {
    ctx.arc(cx, cy + 18, 8, 0, Math.PI);
  } else {
    ctx.moveTo(cx - 8, cy + 22);
    ctx.quadraticCurveTo(cx, cy + 26, cx + 8, cy + 22);
  }
  ctx.stroke();

  // 特色装饰
  if (id === "ma") {
    // 老马:橙色围巾
    ctx.fillStyle = p.acc;
    ctx.fillRect(cx - 45, cy + 50, 90, 16);
  } else if (id === "lin") {
    // 林小姐:耳环
    ctx.fillStyle = p.acc;
    ctx.beginPath();
    ctx.arc(cx - 38, cy + 12, 4, 0, Math.PI * 2);
    ctx.arc(cx + 38, cy + 12, 4, 0, Math.PI * 2);
    ctx.fill();
  } else if (id === "alin") {
    // 阿琳:橙色骑手服领口
    ctx.fillStyle = "#ff7a28";
    ctx.fillRect(cx - 48, cy + 50, 96, 30);
    ctx.fillStyle = p.acc;
    ctx.fillRect(cx - 8, cy + 50, 16, 30);
  } else if (id === "longshu") {
    // 龙叔:老花镜
    ctx.strokeStyle = "#a0a0a0";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx - 14, cy - 4, 10, 0, Math.PI * 2);
    ctx.arc(cx + 14, cy - 4, 10, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 名字 + 标签
  ctx.fillStyle = "#fff";
  ctx.font = "bold 26px Microsoft YaHei, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(p.name, cx, 244);
  ctx.fillStyle = p.acc;
  ctx.font = "14px Microsoft YaHei, sans-serif";
  ctx.fillText(p.tag, cx, 30);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export const NPC_IDS = ["ma", "longshu", "lin", "alin"] as const;
export type NpcId = (typeof NPC_IDS)[number];

export const NPC_NAME_TO_ID: Record<string, NpcId> = {
  老马: "ma",
  龙叔: "longshu",
  林小姐: "lin",
  阿琳: "alin",
};
