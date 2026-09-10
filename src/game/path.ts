import { CELL, GRID_N, H_STREETS, V_STREETS } from "./config";
import { clamp } from "./rng";
import type { GridNode, NavTurn, Sample } from "./types";

export function nodePos(n: GridNode) {
  return { x: n.i * CELL, z: n.j * CELL };
}

export function streetBetween(a: GridNode, b: GridNode) {
  if (a.i === b.i) return V_STREETS[a.i] ?? "无名路";
  return H_STREETS[a.j] ?? "无名路";
}

export class Route {
  samples: Sample[] = [];
  turns: NavTurn[] = [];
  length = 0;
  pickupS = 0;
  dropoffS = 0;
  points: { x: number; z: number }[] = [];

  at(s: number): Sample {
    const list = this.samples;
    if (list.length === 0) {
      return { x: 0, z: 0, tx: 0, tz: 1, rx: 1, rz: 0, yaw: 0, s: 0 };
    }
    const t = clamp(s, 0, this.length);
    let lo = 0;
    let hi = list.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (list[mid]!.s < t) lo = mid + 1;
      else hi = mid;
    }
    const b = list[lo]!;
    const a = list[Math.max(0, lo - 1)]!;
    if (b.s === a.s) return b;
    const u = clamp((t - a.s) / Math.max(0.0001, b.s - a.s), 0, 1);
    const tx = a.tx + (b.tx - a.tx) * u;
    const tz = a.tz + (b.tz - a.tz) * u;
    const len = Math.hypot(tx, tz) || 1;
    return {
      x: a.x + (b.x - a.x) * u,
      z: a.z + (b.z - a.z) * u,
      tx: tx / len,
      tz: tz / len,
      rx: a.rx + (b.rx - a.rx) * u,
      rz: a.rz + (b.rz - a.rz) * u,
      yaw: a.yaw + shortAngle(b.yaw - a.yaw) * u,
      s: t,
    };
  }

  nextTurn(s: number) {
    const turn = this.turns.find((t) => t.s > s + 2);
    if (!turn) {
      const remain = Math.max(0, this.length - s);
      return { dir: "arrive" as const, dist: remain, street: "目的地" };
    }
    return { dir: turn.dir, dist: Math.max(0, turn.s - s), street: turn.street };
  }
}

function shortAngle(a: number) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function astar(from: GridNode, to: GridNode): GridNode[] {
  const key = (n: GridNode) => `${n.i},${n.j}`;
  const start = key(from);
  const goal = key(to);
  const open = [from];
  const came = new Map<string, string>();
  const g = new Map<string, number>([[start, 0]]);
  const h = (n: GridNode) => Math.abs(n.i - to.i) + Math.abs(n.j - to.j);

  while (open.length) {
    open.sort((a, b) => (g.get(key(a)) ?? 9e9) + h(a) - ((g.get(key(b)) ?? 9e9) + h(b)));
    const cur = open.shift()!;
    if (key(cur) === goal) break;
    for (const [di, dj] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nb = { i: cur.i + di, j: cur.j + dj };
      if (nb.i < 0 || nb.j < 0 || nb.i >= GRID_N || nb.j >= GRID_N) continue;
      const nk = key(nb);
      const ng = (g.get(key(cur)) ?? 9e9) + 1;
      if (ng < (g.get(nk) ?? 9e9)) {
        came.set(nk, key(cur));
        g.set(nk, ng);
        if (!open.some((n) => key(n) === nk)) open.push(nb);
      }
    }
  }

  const path: GridNode[] = [];
  let k = goal;
  if (!came.has(k) && k !== start) return [from, to];
  while (k) {
    const [i, j] = k.split(",").map(Number);
    path.push({ i: i!, j: j! });
    if (k === start) break;
    k = came.get(k) ?? "";
  }
  path.reverse();
  return path.length ? path : [from];
}

function smoothCorners(pts: { x: number; z: number }[], radius = 8.5) {
  if (pts.length < 3) return pts.slice();
  const out: { x: number; z: number }[] = [];
  out.push(pts[0]!);
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1]!;
    const curr = pts[i]!;
    const next = pts[i + 1]!;
    const d0x = curr.x - prev.x;
    const d0z = curr.z - prev.z;
    const d1x = next.x - curr.x;
    const d1z = next.z - curr.z;
    const l0 = Math.hypot(d0x, d0z) || 1;
    const l1 = Math.hypot(d1x, d1z) || 1;
    const n0x = d0x / l0;
    const n0z = d0z / l0;
    const n1x = d1x / l1;
    const n1z = d1z / l1;
    const straight = n0x * n1x + n0z * n1z > 0.96;
    if (straight) {
      out.push(curr);
      continue;
    }
    const r = Math.min(radius, l0 * 0.42, l1 * 0.42);
    const a = { x: curr.x - n0x * r, z: curr.z - n0z * r };
    const c = { x: curr.x + n1x * r, z: curr.z + n1z * r };
    const steps = 8;
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      const omt = 1 - t;
      out.push({
        x: omt * omt * a.x + 2 * omt * t * curr.x + t * t * c.x,
        z: omt * omt * a.z + 2 * omt * t * curr.z + t * t * c.z,
      });
    }
  }
  out.push(pts[pts.length - 1]!);
  return out;
}

function samplePoly(pts: { x: number; z: number }[], step = 1.15): Sample[] {
  const samples: Sample[] = [];
  let s = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.01) continue;
    const tx = dx / len;
    const tz = dz / len;
    const segs = Math.max(1, Math.round(len / step));
    for (let k = 0; k < segs; k++) {
      const u = k / segs;
      const yaw = Math.atan2(tx, tz);
      samples.push({
        x: a.x + dx * u,
        z: a.z + dz * u,
        tx,
        tz,
        rx: tz,
        rz: -tx,
        yaw,
        s,
      });
      s += len / segs;
    }
  }
  const last = pts[pts.length - 1]!;
  const prev = samples[samples.length - 1];
  if (prev) {
    samples.push({ ...prev, x: last.x, z: last.z, s });
  }
  return samples;
}

function turnsFromNodes(nodes: GridNode[], samples: Sample[]): NavTurn[] {
  const turns: NavTurn[] = [];
  let sAcc = 0;
  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodePos(nodes[i]!);
    const b = nodePos(nodes[i + 1]!);
    const seg = Math.hypot(b.x - a.x, b.z - a.z);
    if (i >= 1) {
      const p = nodes[i - 1]!;
      const c = nodes[i]!;
      const n = nodes[i + 1]!;
      const inx = c.i - p.i;
      const inz = c.j - p.j;
      const outx = n.i - c.i;
      const outz = n.j - c.j;
      const cross = inx * outz - inz * outx;
      if (cross !== 0) {
        turns.push({
          s: sAcc,
          dir: cross < 0 ? "right" : "left",
          street: streetBetween(c, n),
        });
      }
    }
    sAcc += seg;
  }
  if (samples.length) {
    for (const t of turns) t.s = clamp(t.s, 0, samples[samples.length - 1]!.s);
  }
  return turns;
}

function nearestAlong(route: Route, dest: GridNode) {
  const p = nodePos(dest);
  let best = 0;
  let d = 1e9;
  for (const sm of route.samples) {
    const dd = Math.hypot(sm.x - p.x, sm.z - p.z);
    if (dd < d) {
      d = dd;
      best = sm.s;
    }
  }
  return best;
}

/** Single-leg path: current position → one destination (取餐或送达). */
export function buildLeg(from: GridNode, dest: GridNode): Route {
  let nodes = astar(from, dest);
  if (nodes.length < 2) {
    const j = dest.j < GRID_N - 1 ? dest.j + 1 : Math.max(0, dest.j - 1);
    nodes = [from, { i: dest.i, j }];
  }
  const raw = nodes.map(nodePos);
  const smooth = smoothCorners(raw);
  const route = new Route();
  route.samples = samplePoly(smooth);
  if (!route.samples.length) {
    const p = nodePos(from);
    route.samples = [{ x: p.x, z: p.z, tx: 0, tz: 1, rx: 1, rz: 0, yaw: 0, s: 0 }];
  }
  route.length = route.samples[route.samples.length - 1]?.s ?? 0;
  route.points = smooth.length ? smooth : [nodePos(from)];
  route.turns = turnsFromNodes(nodes, route.samples);
  const destS = nearestAlong(route, dest);
  route.pickupS = destS;
  route.dropoffS = destS;
  extendRoute(route, 10);
  return route;
}

function extendRoute(route: Route, extra: number) {
  const last = route.samples[route.samples.length - 1];
  if (!last || extra <= 0) return;
  const step = 1.1;
  let s = last.s;
  for (let d = step; d <= extra; d += step) {
    s += step;
    route.samples.push({
      x: last.x + last.tx * d,
      z: last.z + last.tz * d,
      tx: last.tx,
      tz: last.tz,
      rx: last.rx,
      rz: last.rz,
      yaw: last.yaw,
      s,
    });
  }
  route.length = route.samples[route.samples.length - 1]?.s ?? route.length;
  const end = route.samples[route.samples.length - 1]!;
  route.points = [...route.points, { x: end.x, z: end.z }];
}
