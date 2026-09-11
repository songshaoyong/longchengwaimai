import { CUSTOMERS, CUSTOMER_LINES, CUSTOMER_NOTES, FOODS, RANK_THRESHOLDS, SHOP_LINES } from "../data/catalog";
import {
  STORY_ARCS,
  defaultStoryProgress,
  pickAvailableStory,
  type StoryArcId,
  type StoryBeat,
  type StoryProgress,
} from "../data/stories";
import type { Track } from "./city";
import { pick } from "./rng";
import type { Order, OrderKind, PlayerStats } from "./types";

let seq = 1;

export class OrderSystem {
  offers: Order[] = [];
  active: Order | null = null;
  cooldown = 0.8;
  tutorialDone = false;
  storyProgress: StoryProgress = defaultStoryProgress();
  /** 本波是否已塞过剧情单，避免同一刷单窗口刷两张 */
  private storyOfferedThisWave = false;

  constructor(private track: Track) {}

  update(dt: number, stats: PlayerStats) {
    if (this.active) {
      this.active.remaining -= dt;
      if (this.active.kind === "hot" || this.active.kind === "fragile") {
        this.active.heat = Math.max(0, this.active.heat - dt * 0.03);
      }
      return null;
    }
    for (const o of this.offers) o.expire -= dt;
    const before = this.offers.length;
    this.offers = this.offers.filter((o) => o.expire > 0);
    this.cooldown -= dt;
    const want = this.tutorialDone ? 3 : 1;
    if (this.cooldown <= 0 && this.offers.length < want) {
      if (!this.tutorialDone) {
        this.offers.push(this.tutorialOrder());
      } else {
        this.storyOfferedThisWave = false;
        const used = new Set(this.offers.map((o) => o.customerName + o.restaurantName));
        // 优先塞一张常客剧情单
        const story = this.tryStoryOrder(stats);
        if (story) {
          this.offers.push(story);
          used.add(story.customerName + story.restaurantName);
          this.storyOfferedThisWave = true;
        }
        let guard = 0;
        while (this.offers.length < want && guard++ < 8) {
          const next = this.randomOrder(stats);
          const key = next.customerName + next.restaurantName;
          if (used.has(key)) continue;
          used.add(key);
          this.offers.push(next);
        }
      }
      this.cooldown = this.tutorialDone ? 4.5 : 0.2;
      return "new";
    }
    if (before > 0 && this.offers.length === 0) {
      this.cooldown = 1.6;
      return "expired";
    }
    return null;
  }

  accept(id: string) {
    const idx = this.offers.findIndex((o) => o.id === id);
    if (idx < 0 || this.active) return null;
    this.active = this.offers[idx]!;
    this.offers = [];
    this.tutorialDone = true;
    this.active.phase = "toPickup";
    this.active.chats = [{ from: this.active.restaurantName, text: "已接单，厨房在做。" }];
    if (this.active.offerHint) {
      this.active.chats.push({ from: "龙城外卖", text: this.active.offerHint });
    }
    return this.active;
  }

  addChat(from: string, text: string) {
    if (!this.active) return;
    this.active.chats.push({ from, text });
    if (this.active.chats.length > 6) this.active.chats.shift();
  }

  addBump(amount: number) {
    if (!this.active) return;
    const k = this.active.kind === "fragile" || this.active.kind === "hot" ? 16 : 8;
    this.active.bump = Math.min(100, this.active.bump + amount * k);
  }

  fail(stats: PlayerStats, reason: string) {
    const order = this.active;
    if (!order) return null;
    this.active = null;
    this.cooldown = 2.2;
    stats.combo = 0;
    return {
      stars: 1,
      lines: [reason, "订单失败"],
      pay: 0,
      food: order.food,
      customer: order.customerName,
      storyTalk: null as { who: string; text: string }[] | null,
    };
  }

  settle(stats: PlayerStats) {
    const order = this.active;
    if (!order) return null;
    const onTime = order.remaining >= 0;
    const timeScore = onTime ? (order.remaining / order.limitSec > 0.2 ? 5 : 4) : order.remaining > -10 ? 3 : 2;
    const condScore = order.bump > 70 ? 1 : order.bump > 40 ? 3 : order.bump > 18 ? 4 : 5;
    const heatScore =
      order.kind === "hot" || order.kind === "fragile" ? (order.heat > 0.55 ? 5 : order.heat > 0.3 ? 3 : 2) : 5;
    const comboScore = stats.combo >= 6 ? 5 : 4;
    const avg = (timeScore + condScore + heatScore + comboScore) / 4;
    const stars = Math.max(1, Math.min(5, Math.round(avg)));
    const tip = stars >= 5 ? Math.round(order.pay * (0.08 + stats.combo * 0.015)) : 0;
    const ontimeBonus = onTime ? Math.round(order.pay * 0.15) : -Math.round(order.pay * 0.2);
    const storyBonus = order.storyArc ? 6 : 0;
    const total = Math.max(4, order.pay + ontimeBonus + tip + storyBonus);
    stats.money += total;
    stats.deliveries += 1;
    if (stars >= 4) stats.goodReviews += 1;

    let storyTalk: { who: string; text: string }[] | null = null;
    if (order.storyArc && order.storyBeatId) {
      storyTalk = this.advanceStory(order.storyArc, order.storyBeatId);
    }

    this.active = null;
    this.cooldown = storyTalk ? 0.8 : 2.4;
    return {
      stars,
      lines: [
        `准时：${timeScore} 星`,
        `完好：${condScore} 星`,
        `跑酷连击 x${stats.combo}`,
        onTime ? "准时奖励已计入" : "超时扣减已计入",
        tip ? `小费 +¥${tip}` : "无小费",
        storyBonus ? `常客心意 +¥${storyBonus}` : "",
      ].filter(Boolean),
      pay: total,
      food: order.food,
      customer: order.customerName,
      storyTalk,
    };
  }

  private advanceStory(arcId: StoryArcId, beatId: string) {
    const arc = STORY_ARCS.find((a) => a.id === arcId);
    if (!arc) return null;
    const idx = this.storyProgress[arcId] ?? 0;
    const beat = arc.beats[idx];
    if (!beat || beat.id !== beatId) return null;
    this.storyProgress[arcId] = idx + 1;
    return beat.afterTalk;
  }

  rank(stats: PlayerStats) {
    let current = RANK_THRESHOLDS[0]!;
    let next = RANK_THRESHOLDS[1] ?? RANK_THRESHOLDS[0]!;
    for (let i = 0; i < RANK_THRESHOLDS.length; i++) {
      const row = RANK_THRESHOLDS[i]!;
      if (stats.goodReviews >= row.reviews) {
        current = row;
        next = RANK_THRESHOLDS[i + 1] ?? row;
      }
    }
    return { current, next };
  }

  private tryStoryOrder(stats: PlayerStats): Order | null {
    if (this.storyOfferedThisWave) return null;
    // 约 55% 概率尝试塞剧情单（有可解锁时），避免每波都是剧情
    if (Math.random() > 0.55 && stats.deliveries > 0) return null;
    const hit = pickAvailableStory(this.storyProgress, stats.deliveries);
    if (!hit) return null;
    return this.fromBeat(hit.arcId, hit.beat);
  }

  private tutorialOrder(): Order {
    const hit = pickAvailableStory(this.storyProgress, 0);
    if (hit) return this.fromBeat(hit.arcId, hit.beat, 99);
    const rest = this.track.restaurants[0]!;
    const cust = this.track.customers[0]!;
    return this.make(
      "hot",
      "白粥",
      rest.name,
      "龙叔",
      cust.name,
      "放门口就行，别敲门。",
      rest.node,
      cust.node,
      99,
    );
  }

  private fromBeat(arcId: StoryArcId, beat: StoryBeat, expire = 16): Order {
    const rest =
      this.track.restaurants.find((r) => r.name === beat.restaurant) ??
      this.track.restaurants[0]!;
    const cust =
      this.track.customers.find((c) => c.name === beat.dropoff) ?? this.track.customers[0]!;
    const order = this.make(
      beat.kind,
      beat.food,
      rest.name,
      beat.customer,
      cust.name,
      beat.note,
      rest.node,
      cust.node,
      expire,
    );
    order.storyArc = arcId;
    order.storyBeatId = beat.id;
    order.offerHint = beat.offerHint;
    order.pay = Math.round(order.pay * 1.15);
    return order;
  }

  private randomOrder(stats: PlayerStats): Order {
    const food = pick(Math.random, FOODS);
    let kind: OrderKind = food.type;
    if (Math.random() < 0.22) kind = "urgent";
    if (Math.random() < 0.12) kind = "heavy";
    const rest = pick(Math.random, this.track.restaurants);
    const cust = pick(Math.random, this.track.customers);
    const customer = pick(Math.random, CUSTOMERS);
    const notes = CUSTOMER_NOTES[customer];
    const story = notes ? pick(Math.random, notes) : CUSTOMER_LINES[customer]?.[0];
    const order = this.make(kind, food.name, rest.name, customer, cust.name, story, rest.node, cust.node);
    if (stats.bestCombo > 8) order.pay = Math.round(order.pay * 1.1);
    return order;
  }

  private make(
    kind: OrderKind,
    food: string,
    restaurantName: string,
    customerName: string,
    dropoffName: string,
    story: string | undefined,
    pickup: Order["pickup"],
    dropoff: Order["dropoff"],
    expire = kind === "urgent" ? 9 : 13,
  ): Order {
    const base = 28;
    const mult = kind === "urgent" ? 1.8 : kind === "heavy" ? 2.1 : kind === "fragile" ? 1.25 : 1;
    const shops = SHOP_LINES[restaurantName];
    return {
      id: `o${seq++}`,
      kind,
      food,
      restaurantName,
      customerName,
      dropoffName,
      pickup,
      dropoff,
      pickupS: 0,
      dropoffS: 0,
      pay: Math.round(base * mult),
      limitSec: 40,
      remaining: 40,
      bump: 0,
      heat: 1,
      story,
      note: story,
      shopLine: shops ? pick(Math.random, shops) : "餐好了，门口取。",
      phase: "offer",
      expire,
      chats: [],
      pingedShop: false,
      pingedNear: false,
      pingedLate: false,
    };
  }
}

export function kindLabel(kind: OrderKind) {
  return {
    normal: "普通单",
    urgent: "急单",
    heavy: "大单",
    fragile: "易颠簸",
    hot: "保温单",
  }[kind];
}
