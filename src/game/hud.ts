import { CELL, CITY_SPAN, GRID_N } from "./config";
import type { Track } from "./city";
import { nodePos } from "./path";
import { kindLabel, type OrderSystem } from "./orders";
import { periodName } from "./period";
import { makeNpcTexture, NPC_NAME_TO_ID } from "./portraits";
import type { Order, PlayerStats } from "./types";
import type { Rider } from "./bike";

function el<T extends HTMLElement>(id: string) {
  const node = document.getElementById(id);
  if (!node) throw new Error(id);
  return node as T;
}

export class Hud {
  private money = el<HTMLElement>("money");
  private rankName = el<HTMLElement>("rank-name");
  private rankProgress = el<HTMLElement>("rank-progress");
  private clock = el<HTMLElement>("clock");
  private weather = el<HTMLElement>("weather-label");
  private battery = el<HTMLElement>("battery-bar");
  private stamina = el<HTMLElement>("stamina-bar");
  private bumpBar = el<HTMLElement>("bump-bar");
  private tempBar = el<HTMLElement>("temp-bar");
  private bumpMeter = el<HTMLElement>("bump-meter");
  private tempMeter = el<HTMLElement>("temp-meter");
  private speed = el<HTMLElement>("speed");
  private prompt = el<HTMLElement>("prompt");
  private toast = el<HTMLElement>("toast");
  private navIcon = el<HTMLElement>("nav-icon");
  private navDist = el<HTMLElement>("nav-dist");
  private navAction = el<HTMLElement>("nav-action");
  private active = el<HTMLElement>("active-order");
  private offers = el<HTMLElement>("offers");
  private stars = el<HTMLElement>("stars");
  private resultLines = el<HTMLElement>("result-lines");
  private resultPay = el<HTMLElement>("result-pay");
  private dlgWho = el<HTMLElement>("dlg-who");
  private dlgText = el<HTMLElement>("dlg-text");
  private dlgPortrait = el<HTMLImageElement>("dlg-portrait");
  private resultPortrait = el<HTMLImageElement>("result-portrait");
  private portraitCache: Record<string, string> = {};
  private combo = el<HTMLElement>("combo");
  private deliveries = el<HTMLElement>("deliveries");
  private map = el<HTMLCanvasElement>("minimap");
  private mapCtx = this.map.getContext("2d")!;
  private phoneKey = "";
  private chat = el<HTMLElement>("chat");
  private phoneStatus = el<HTMLElement>("phone-status");
  private phoneRoot = el<HTMLElement>("phone");

  show(id: string, on: boolean) {
    el<HTMLElement>(id).classList.toggle("hidden", !on);
  }

  setClock(minutes: number, raining: boolean) {
    const h = Math.floor(minutes / 60) % 24;
    const m = Math.floor(minutes % 60);
    this.clock.textContent = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    this.weather.textContent = `${raining ? "小雨" : "晴"} · ${periodName(minutes / 60)}`;
  }

  setPrompt(text: string | null) {
    this.prompt.classList.toggle("hidden", !text);
    this.prompt.textContent = text ?? "";
  }

  toastMsg(text: string) {
    const item = document.createElement("div");
    item.className = "item";
    item.textContent = text;
    this.toast.appendChild(item);
    setTimeout(() => item.remove(), 2800);
  }

  setCombo(n: number) {
    this.combo.classList.toggle("hidden", n < 2);
    this.combo.innerHTML = `连击 <b>x${n}</b>`;
    this.combo.classList.remove("pop");
    void this.combo.offsetWidth;
    if (n >= 2) this.combo.classList.add("pop");
  }

  hurt() {
    const node = document.getElementById("hurt");
    if (!node) return;
    node.classList.remove("flash");
    void node.offsetWidth;
    node.classList.add("flash");
  }

  stats(stats: PlayerStats, speed: number, orders: OrderSystem) {
    this.money.textContent = `¥${stats.money}`;
    this.deliveries.textContent = String(stats.deliveries);
    const rank = orders.rank(stats);
    this.rankName.textContent = rank.current.name;
    this.rankProgress.textContent = `${stats.goodReviews} / ${rank.next.reviews}`;
    this.battery.style.width = `${stats.battery}%`;
    this.stamina.style.width = `${stats.stamina}%`;
    this.speed.textContent = String(Math.max(0, Math.round(speed * 3.2)));
    this.setCombo(stats.combo);
  }

  meters(order: Order | null, holding: boolean) {
    const showBump = Boolean(holding && order && (order.kind === "fragile" || order.kind === "hot"));
    const showTemp = Boolean(holding && order && (order.kind === "hot" || order.kind === "fragile"));
    this.bumpMeter.classList.toggle("hidden", !showBump);
    this.tempMeter.classList.toggle("hidden", !showTemp);
    if (order) {
      this.bumpBar.style.width = `${order.bump}%`;
      this.tempBar.style.width = `${order.heat * 100}%`;
    }
  }

  phone(offers: Order[], active: Order | null, holding: boolean, onAccept: (id: string) => void) {
    if (!active) {
      this.active.className = "empty";
      this.active.textContent = offers.length ? "新订单来了，选一单再出发" : "附近暂时没有单，等一等…";
      this.chat.innerHTML = "";
      this.phoneStatus.textContent = offers.length ? "待接单" : "听单中";
      this.phoneRoot.classList.toggle("alert", offers.length > 0);
    } else {
      this.active.className = holding ? "run" : "pick";
      const t = Math.max(0, Math.ceil(active.remaining));
      this.phoneStatus.textContent = holding ? "配送中" : "取餐中";
      this.phoneRoot.classList.remove("alert");
      this.active.innerHTML = `
        <div class="food">${active.food} <span>¥${active.pay}</span></div>
        <div class="flow">
          <div class="leg ${holding ? "done" : "now"}">${holding ? "✓" : "①"} 取餐 · ${active.restaurantName}</div>
          <div class="leg ${holding ? "now" : "wait"}">${holding ? "②" : "○"} 送达 · ${active.customerName} · ${active.dropoffName}</div>
        </div>
        <div class="limit ${t < 12 ? "warn" : ""}">剩余 ${t}s${active.note ? ` · ${active.note}` : ""}</div>
      `;
      this.chat.innerHTML = active.chats
        .map(
          (c) =>
            `<div class="bubble ${c.from === active.customerName ? "cust" : "shop"}"><i>${c.from}</i>${c.text}</div>`,
        )
        .join("");
    }

    const key = `${active?.id ?? ""}:${active?.chats.length ?? 0}:${offers.map((o) => `${o.id}:${Math.ceil(o.expire)}`).join(",")}`;
    if (key === this.phoneKey) return;
    this.phoneKey = key;
    this.offers.innerHTML = "";
    if (active) return;
    offers.forEach((o, i) => {
      const card = document.createElement("div");
      card.className = `offer ${o.kind === "urgent" ? "urgent" : ""}`;
      card.innerHTML = `
        <div class="offer-top"><span>${kindLabel(o.kind)} · ${o.food}</span><b>¥${o.pay}</b></div>
        <div class="meta">① ${o.restaurantName} 取餐 → ② ${o.customerName}</div>
        ${o.note ? `<div class="note">备注：${o.note}</div>` : ""}
        <div class="offer-bot"><span>${Math.max(1, Math.ceil(o.expire))}s 后过期</span><button type="button">接单 ${i + 1}</button></div>
      `;
      card.querySelector("button")?.addEventListener("click", () => onAccept(o.id));
      this.offers.appendChild(card);
    });
  }

  nav(rider: Rider, holding: boolean, waiting = false) {
    if (waiting) {
      this.navIcon.textContent = "▣";
      this.navDist.textContent = "听单";
      this.navAction.textContent = "看右下角手机，按 1 / 2 / 3 接单";
      return;
    }
    const route = rider.route;
    if (!route) {
      this.navIcon.textContent = "•";
      this.navDist.textContent = "--";
      this.navAction.textContent = "正在规划路线…";
      return;
    }
    const turn = route.nextTurn(rider.s);
    const destS = holding ? route.dropoffS : route.pickupS;
    const destLeft = Math.max(0, destS - rider.s);
    if (turn.dir === "arrive" || destLeft <= turn.dist + 1) {
      this.navIcon.textContent = holding ? "◉" : "◎";
      this.navDist.textContent = `${Math.round(destLeft)}米`;
      this.navAction.textContent = holding ? "即将送达客户" : "即将到达店门口取餐";
    } else {
      this.navIcon.textContent = turn.dir === "left" ? "↰" : "↱";
      this.navDist.textContent = `${Math.round(turn.dist)}米`;
      this.navAction.textContent = `${holding ? "送餐" : "去取餐"} · ${turn.dir === "left" ? "左转" : "右转"}进入${turn.street}`;
    }
  }

  showDialogue(who: string, text: string) {
    this.show("dialogue", true);
    this.dlgWho.textContent = who;
    this.dlgText.textContent = text;
    this.setPortrait(this.dlgPortrait, who);
  }

  showResult(stars: number, lines: string[], pay: number, customer?: string) {
    this.show("result", true);
    this.stars.textContent = "★".repeat(stars) + "☆".repeat(5 - stars);
    this.resultLines.innerHTML = lines.map((l) => `<li>${l}</li>`).join("");
    this.resultPay.textContent = pay > 0 ? `+ ¥${pay}` : "未入账";
    this.setPortrait(this.resultPortrait, customer ?? "");
  }

  private setPortrait(img: HTMLImageElement, name: string) {
    const id = NPC_NAME_TO_ID[name];
    if (!id) {
      img.classList.add("hidden");
      img.src = "";
      return;
    }
    if (!this.portraitCache[id]) {
      const tex = makeNpcTexture(id);
      // CanvasTexture 转 dataURL
      const c = tex.image as HTMLCanvasElement;
      this.portraitCache[id] = c.toDataURL();
    }
    img.src = this.portraitCache[id]!;
    img.classList.remove("hidden");
  }

  drawGps(track: Track, rider: Rider, holding: boolean) {
    const ctx = this.mapCtx;
    const w = this.map.width;
    const h = this.map.height;
    ctx.fillStyle = "#080e18";
    ctx.fillRect(0, 0, w, h);

    const sm = rider.sample();
    const tx = sm?.tx ?? 0;
    const tz = sm?.tz ?? 1;
    const rx = sm?.rx ?? 1;
    const rz = sm?.rz ?? 0;
    const px = rider.x;
    const pz = rider.z;
    const scale = 0.48;
    const worldTo = (x: number, z: number) => {
      const dx = x - px;
      const dz = z - pz;
      const localX = dx * rx + dz * rz;
      const localZ = dx * tx + dz * tz;
      return { x: w / 2 + localX * scale, y: h * 0.68 - localZ * scale };
    };

    ctx.strokeStyle = "#1a2838";
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    for (let i = 0; i < GRID_N; i++) {
      const a = worldTo(0, i * CELL);
      const b = worldTo(CITY_SPAN, i * CELL);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      const c = worldTo(i * CELL, 0);
      const d = worldTo(i * CELL, CITY_SPAN);
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.stroke();
    }

    ctx.fillStyle = "#ff9a3a";
    for (const r of track.restaurants) {
      const p = nodePos(r.node);
      const s = worldTo(p.x, p.z);
      ctx.beginPath();
      ctx.arc(s.x, s.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "#ff2d95";
    for (const c of track.customers) {
      const p = nodePos(c.node);
      const s = worldTo(p.x, p.z);
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    const route = rider.route;
    if (route && route.points.length > 1) {
      const glow = holding ? "#ff2d95" : "#3df0ff";
      ctx.strokeStyle = holding ? "rgba(255, 45, 149, 0.35)" : "rgba(61, 240, 255, 0.35)";
      ctx.lineWidth = 8;
      ctx.shadowColor = glow;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      route.points.forEach((p, i) => {
        const s = worldTo(p.x, p.z);
        if (i === 0) ctx.moveTo(s.x, s.y);
        else ctx.lineTo(s.x, s.y);
      });
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = glow;
      ctx.lineWidth = 3;
      ctx.beginPath();
      route.points.forEach((p, i) => {
        const s = worldTo(p.x, p.z);
        if (i === 0) ctx.moveTo(s.x, s.y);
        else ctx.lineTo(s.x, s.y);
      });
      ctx.stroke();
      const dest = holding ? route.at(route.dropoffS) : route.at(route.pickupS);
      const dp = worldTo(dest.x, dest.z);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(dp.x, dp.y, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.save();
    ctx.translate(w / 2, h * 0.68);
    ctx.fillStyle = holding ? "#ff9a3a" : "#ffffff";
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(-7, 9);
    ctx.lineTo(7, 9);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = "rgba(8,16,24,0.75)";
    ctx.fillRect(0, h - 22, w, 22);
    ctx.fillStyle = "#9bb0c9";
    ctx.font = "12px Microsoft YaHei, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("龙城导航 · 车头朝上", w / 2, h - 7);
  }
}
