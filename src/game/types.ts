export type OrderKind = "normal" | "urgent" | "heavy" | "fragile" | "hot";

export type GameMode = "title" | "playing" | "dialogue" | "pause";

export type ObstacleKind = "barrier" | "car" | "hang" | "cone";

export type GridNode = { i: number; j: number };

export type Obstacle = {
  kind: ObstacleKind;
  s: number;
  lateral: number;
  halfW: number;
  depth: number;
  hit: boolean;
  dodged: boolean;
};

export type Gate = {
  kind: "pickup" | "dropoff";
  s: number;
  name: string;
  used: boolean;
};

export type Sample = {
  x: number;
  z: number;
  tx: number;
  tz: number;
  rx: number;
  rz: number;
  yaw: number;
  s: number;
  /** 当前采样点是否在胡同内（窄道限速 / 拉近镜头） */
  hutong?: boolean;
};

export type NavTurn = {
  s: number;
  dir: "left" | "right" | "arrive";
  street: string;
};

export type Order = {
  id: string;
  kind: OrderKind;
  food: string;
  restaurantName: string;
  customerName: string;
  dropoffName: string;
  pickup: GridNode;
  dropoff: GridNode;
  pickupS: number;
  dropoffS: number;
  pay: number;
  limitSec: number;
  remaining: number;
  bump: number;
  heat: number;
  story?: string;
  note?: string;
  shopLine?: string;
  offerHint?: string;
  phase: "offer" | "toPickup" | "toDropoff";
  expire: number;
  chats: { from: string; text: string }[];
  pingedShop: boolean;
  pingedNear: boolean;
  pingedLate: boolean;
  /** 常客剧情：弧 id + beat id */
  storyArc?: "longshu" | "ma" | "lin";
  storyBeatId?: string;
};

export type PlayerStats = {
  name: string;
  money: number;
  goodReviews: number;
  deliveries: number;
  stamina: number;
  battery: number;
  combo: number;
  bestCombo: number;
};
