import * as THREE from "three";
import { CELL, CITY_SPAN, GRID_N, RESTAURANTS, RIBBON_MAX, ROAD_W } from "./config";
import { CUSTOMER_NODES, RESTAURANT_NODES } from "../data/catalog";
import { makeFacadeMaps, makeNeonSign, makeRoadTexture, makeSidewalkTexture } from "./textures";
import { mulberry32 } from "./rng";
import { Route, buildLeg } from "./path";
import { CityLife } from "./life";
import type { Gate, GridNode, Obstacle } from "./types";

export class Track {
  readonly group = new THREE.Group();
  readonly obstacles: Obstacle[] = [];
  readonly gates: Gate[] = [];
  readonly restaurants: { name: string; node: GridNode }[] = [];
  readonly customers: { name: string; node: GridNode }[] = [];
  route: Route | null = null;
  private rng = mulberry32(2040);
  private stripeMat: THREE.MeshStandardMaterial;
  private carMats: THREE.MeshStandardMaterial[];
  private glassMat: THREE.MeshStandardMaterial;
  private hangMat: THREE.MeshStandardMaterial;
  private coneMat: THREE.MeshStandardMaterial;
  private ribbon: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private gateMeshes: THREE.Object3D[] = [];
  private roofMat: THREE.MeshStandardMaterial;
  private awningMat: THREE.MeshStandardMaterial;
  private life = new CityLife();
  private postMat: THREE.MeshStandardMaterial;
  private facadeMats: THREE.MeshStandardMaterial[] = [];
  private roadMat!: THREE.MeshStandardMaterial;
  private walkMat!: THREE.MeshStandardMaterial;
  private groundMat!: THREE.MeshStandardMaterial;
  private lampLights: THREE.PointLight[] = [];
  private bulbMat!: THREE.MeshStandardMaterial;
  private neonGlows: THREE.MeshBasicMaterial[] = [];
  private lanternMats: THREE.MeshStandardMaterial[] = [];
  private skylineMat!: THREE.MeshStandardMaterial;

  constructor() {
    const roadTex = makeRoadTexture();
    roadTex.repeat.set(CITY_SPAN / 8, 1);
    const roadMat = new THREE.MeshStandardMaterial({
      map: roadTex,
      roughness: 0.22,
      metalness: 0.35,
      color: 0xc5d0dc,
    });
    this.roadMat = roadMat;
    const walkTex = makeSidewalkTexture();
    walkTex.repeat.set(CITY_SPAN / 4, 2);
    const walkMat = new THREE.MeshStandardMaterial({
      map: walkTex,
      roughness: 0.82,
      color: 0x6a5c55,
    });
    this.walkMat = walkMat;
    const facades = [0, 1, 2, 3, 4].map((i) => {
      const maps = makeFacadeMaps(mulberry32(90 + i * 17));
      return new THREE.MeshStandardMaterial({
        map: maps.map,
        emissiveMap: maps.emissiveMap,
        emissive: 0xffffff,
        emissiveIntensity: 1.15,
        roughness: 0.48,
        metalness: 0.12,
      });
    });
    this.facadeMats = facades;
    this.stripeMat = new THREE.MeshStandardMaterial({
      color: 0xff8a20,
      emissive: 0x5a2200,
      emissiveIntensity: 0.55,
    });
    this.carMats = [0xff3355, 0x33ddff, 0xffcc33, 0x7aa0c8, 0xf2f2f2].map(
      (c) => new THREE.MeshStandardMaterial({ color: c, metalness: 0.55, roughness: 0.28 }),
    );
    this.glassMat = new THREE.MeshStandardMaterial({
      color: 0x112233,
      roughness: 0.15,
      metalness: 0.7,
      emissive: 0x223344,
      emissiveIntensity: 0.2,
    });
    this.hangMat = new THREE.MeshStandardMaterial({
      color: 0x3df0ff,
      emissive: 0x3df0ff,
      emissiveIntensity: 2.2,
    });
    this.coneMat = new THREE.MeshStandardMaterial({
      color: 0xff6a1a,
      emissive: 0x4a1400,
      emissiveIntensity: 0.45,
    });
    this.roofMat = new THREE.MeshStandardMaterial({ color: 0x1b222c, roughness: 0.7, metalness: 0.2 });
    this.awningMat = new THREE.MeshStandardMaterial({
      color: 0xff4d7a,
      emissive: 0x3a0018,
      emissiveIntensity: 0.35,
    });
    this.postMat = new THREE.MeshStandardMaterial({
      color: 0x1a1c22,
      metalness: 0.5,
      roughness: 0.4,
    });

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(CITY_SPAN + 220, CITY_SPAN + 200),
      (this.groundMat = new THREE.MeshStandardMaterial({ color: 0x0c0e16, roughness: 0.95 })),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(CITY_SPAN / 2, -0.04, CITY_SPAN / 2);
    this.group.add(ground);

    for (let j = 0; j < GRID_N; j++) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(CITY_SPAN + ROAD_W, ROAD_W), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(CITY_SPAN / 2, 0.02, j * CELL);
      this.group.add(road);
      const walkA = new THREE.Mesh(new THREE.PlaneGeometry(CITY_SPAN + ROAD_W + 3.2, 1.4), walkMat);
      walkA.rotation.x = -Math.PI / 2;
      walkA.position.set(CITY_SPAN / 2, 0.04, j * CELL + ROAD_W * 0.52);
      const walkB = walkA.clone();
      walkB.position.z = j * CELL - ROAD_W * 0.52;
      this.group.add(walkA, walkB);
    }
    for (let i = 0; i < GRID_N; i++) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, CITY_SPAN + ROAD_W), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(i * CELL, 0.03, CITY_SPAN / 2);
      this.group.add(road);
      const walkA = new THREE.Mesh(new THREE.PlaneGeometry(1.4, CITY_SPAN + ROAD_W + 3.2), walkMat);
      walkA.rotation.x = -Math.PI / 2;
      walkA.position.set(i * CELL + ROAD_W * 0.52, 0.045, CITY_SPAN / 2);
      const walkB = walkA.clone();
      walkB.position.x = i * CELL - ROAD_W * 0.52;
      this.group.add(walkA, walkB);
    }

    this.addLamps();
    this.addSkyline();
    this.addCables();
    this.addStreetBanners();
    this.group.add(this.life.group);

    for (let i = 0; i < GRID_N - 1; i++) {
      for (let j = 0; j < GRID_N - 1; j++) {
        this.addBuilding(i, j, facades[Math.floor(this.rng() * facades.length)]!);
      }
    }

    this.placePois();

    const ribbonMat = new THREE.MeshBasicMaterial({
      color: 0x5cffef,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    });
    this.ribbon = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 0.04, 1.7), ribbonMat, RIBBON_MAX);
    this.ribbon.frustumCulled = false;
    this.ribbon.count = 0;
    this.group.add(this.ribbon);
  }

  nearestNode(x: number, z: number): GridNode {
    return {
      i: Math.max(0, Math.min(GRID_N - 1, Math.round(x / CELL))),
      j: Math.max(0, Math.min(GRID_N - 1, Math.round(z / CELL))),
    };
  }

  planTo(
    from: GridNode,
    dest: GridNode,
    gate: { kind: "pickup" | "dropoff"; name: string } | null,
    difficulty = 1,
  ) {
    const route = buildLeg(from, dest);
    this.setRoute(
      route,
      gate?.kind === "pickup" ? gate.name : undefined,
      gate?.kind === "dropoff" ? gate.name : undefined,
      difficulty,
    );
    return route;
  }

  setRoute(route: Route, pickupName?: string, dropoffName?: string, difficulty = 1) {
    this.route = route;
    this.obstacles.length = 0;
    this.gates.length = 0;
    for (const m of this.gateMeshes) m.removeFromParent();
    this.gateMeshes = [];
    this.scatterAlong(route, pickupName, dropoffName, difficulty);
    this.updateRibbon(0);
  }

  updateRibbon(s: number) {
    if (!this.route) {
      this.ribbon.count = 0;
      return;
    }
    let n = 0;
    for (const sm of this.route.samples) {
      if (sm.s < s - 2) continue;
      if (n >= RIBBON_MAX) break;
      if (Math.round(sm.s * 2) % 2 !== 0) continue;
      this.dummy.position.set(sm.x, 0.07, sm.z);
      this.dummy.rotation.set(0, sm.yaw, 0);
      this.dummy.updateMatrix();
      this.ribbon.setMatrixAt(n, this.dummy.matrix);
      n++;
    }
    this.ribbon.count = n;
    this.ribbon.instanceMatrix.needsUpdate = true;
  }

  nextGate() {
    return this.gates.find((g) => !g.used) ?? null;
  }

  aheadObstacle(s: number, look = 24) {
    let best: Obstacle | null = null;
    let bestD = look;
    for (const o of this.obstacles) {
      if (o.hit || o.dodged) continue;
      const d = o.s - s;
      if (d > 1.1 && d < bestD) {
        best = o;
        bestD = d;
      }
    }
    return best;
  }

  update(dt: number) {
    this.life.update(dt);
  }

  setPeriod(night: number) {
    const day = 1 - night;
    for (const m of this.facadeMats) {
      m.color.setRGB(0.72 + night * 0.28, 0.66 + night * 0.3, 0.58 + night * 0.38);
      m.emissiveIntensity = 0.07 + night * 1.12;
    }
    this.roadMat.color.setRGB(0.55 + night * 0.22, 0.56 + night * 0.22, 0.58 + night * 0.24);
    this.roadMat.roughness = 0.55 - night * 0.33;
    this.roadMat.metalness = 0.08 + night * 0.27;
    this.walkMat.color.setRGB(0.55 + day * 0.12, 0.48 + day * 0.08, 0.4);
    this.groundMat.color.setRGB(0.05 + day * 0.28, 0.07 + day * 0.32, 0.09 + day * 0.12);
    this.roofMat.color.setRGB(0.12 + day * 0.28, 0.14 + day * 0.28, 0.17 + day * 0.28);
    this.bulbMat.emissiveIntensity = 0.12 + night * 2.3;
    for (const light of this.lampLights) light.intensity = 3.2 * night;
    for (const g of this.neonGlows) g.opacity = 0.04 + night * 0.16;
    for (const l of this.lanternMats) l.emissiveIntensity = 0.35 + night * 1.45;
    this.skylineMat.color.setRGB(0.08 + day * 0.32, 0.12 + day * 0.28, 0.16 + day * 0.28);
    this.skylineMat.emissiveIntensity = 0.08 + night * 0.18;
    this.awningMat.emissiveIntensity = 0.08 + night * 0.28;
  }

  private addBuilding(i: number, j: number, mat: THREE.Material) {
    const downtown = Math.max(0, 1 - Math.hypot(i - (GRID_N - 1) / 2, j - (GRID_N - 1) / 2) / 7);
    const h = 8 + Math.floor(this.rng() * 14) + Math.floor(downtown * 22);
    const size = CELL - ROAD_W - 1.4;
    const cx = (i + 0.5) * CELL;
    const cz = (j + 0.5) * CELL;
    const b = new THREE.Mesh(new THREE.BoxGeometry(size, h, size), mat);
    b.position.set(cx, h / 2, cz);
    this.group.add(b);

    const setback = new THREE.Mesh(new THREE.BoxGeometry(size * 0.62, 3 + this.rng() * 5, size * 0.62), mat);
    setback.position.set(cx, h + 2, cz);
    this.group.add(setback);

    const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 1.6, 8), this.roofMat);
    tank.position.set(cx + size * 0.18, h + 0.9, cz - size * 0.16);
    this.group.add(tank);

    const awning = new THREE.Mesh(new THREE.BoxGeometry(size * 0.7, 0.12, 1.6), this.awningMat);
    awning.position.set(cx, 3.05, j * CELL + ROAD_W * 0.55 + 0.4);
    this.group.add(awning);

    if (this.rng() > 0.4) {
      const hue = this.rng() > 0.5 ? 0x3df0ff : 0xff2d95;
      const stripMat = new THREE.MeshStandardMaterial({ color: hue, emissive: hue, emissiveIntensity: 2.4 });
      this.lanternMats.push(stripMat);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.14, h + 1.2, 0.14), stripMat);
      strip.position.set(cx + size * 0.5 - 0.08, h / 2, cz + size * 0.5 - 0.08);
      this.group.add(strip);
    }

    if (this.rng() > 0.52) {
      const shop = RESTAURANTS[Math.floor(this.rng() * RESTAURANTS.length)]!;
      const hue = 160 + this.rng() * 180;
      this.addNeon(shop, hue, i * CELL + ROAD_W * 0.58, 5.4, (j + 0.5) * CELL, Math.PI / 2);
    }
    if (this.rng() > 0.72) {
      const shop = RESTAURANTS[Math.floor(this.rng() * RESTAURANTS.length)]!;
      this.addNeon(shop, 20 + this.rng() * 80, (i + 0.5) * CELL, 7.2, j * CELL + ROAD_W * 0.58, 0);
    }
  }

  private addNeon(text: string, hue: number, x: number, y: number, z: number, rotY: number) {
    const mat = new THREE.MeshBasicMaterial({
      map: makeNeonSign(text, hue),
      transparent: true,
      toneMapped: false,
    });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 1.55), mat);
    sign.position.set(x, y, z);
    sign.rotation.y = rotY;
    this.group.add(sign);
    const glowMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color().setHSL(((hue % 360) + 360) % 360 / 360, 1, 0.55),
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    this.neonGlows.push(glowMat);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 1.9), glowMat);
    glow.position.copy(sign.position);
    glow.rotation.y = rotY;
    this.group.add(glow);
  }

  private addLamps() {
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x1a1c22, metalness: 0.6, roughness: 0.4 });
    const bulbMat = new THREE.MeshStandardMaterial({
      color: 0xffe1b0,
      emissive: 0xffc078,
      emissiveIntensity: 2.4,
    });
    this.bulbMat = bulbMat;
    for (let i = 0; i < GRID_N; i++) {
      for (let j = 0; j < GRID_N; j++) {
        const x = i * CELL + 4.8;
        const z = j * CELL + 4.8;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 5.6, 6), poleMat);
        pole.position.set(x, 2.8, z);
        this.group.add(pole);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.08), poleMat);
        arm.position.set(x - 0.7, 5.5, z);
        this.group.add(arm);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), bulbMat);
        bulb.position.set(x - 1.35, 5.35, z);
        this.group.add(bulb);
        if ((i + j) % 4 === 0) {
          const light = new THREE.PointLight(0xffc090, 3.2, 16);
          light.position.set(x - 1.35, 5.3, z);
          this.group.add(light);
          this.lampLights.push(light);
        }
      }
    }
  }

  private addSkyline() {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x0a1018,
      roughness: 0.9,
      emissive: 0x101828,
      emissiveIntensity: 0.25,
    });
    this.skylineMat = mat;
    const ring = [
      [-80, CITY_SPAN / 2],
      [CITY_SPAN + 80, CITY_SPAN / 2],
      [CITY_SPAN / 2, -80],
      [CITY_SPAN / 2, CITY_SPAN + 80],
    ] as const;
    for (const [cx, cz] of ring) {
      for (let n = 0; n < 16; n++) {
        const h = 22 + this.rng() * 56;
        const w = 7 + this.rng() * 12;
        const along = (n - 7.5) * 22;
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), mat);
        const horizontal = Math.abs(cz - CITY_SPAN / 2) < 1;
        b.position.set(horizontal ? cx : cx + along, h / 2, horizontal ? cz + along : cz);
        this.group.add(b);
      }
    }
  }

  private addCables() {
    const lineMat = new THREE.LineBasicMaterial({ color: 0x1a1c22 });
    const lanterns = [0xff2d95, 0x3df0ff, 0xffb347, 0x7dffb3].map(
      (c) =>
        new THREE.MeshStandardMaterial({
          color: c,
          emissive: c,
          emissiveIntensity: 1.8,
        }),
    );
    this.lanternMats = lanterns;
    for (let n = 0; n < 40; n++) {
      const i = Math.floor(this.rng() * (GRID_N - 1));
      const j = Math.floor(this.rng() * (GRID_N - 1));
      const x0 = i * CELL + ROAD_W * 0.55;
      const x1 = (i + 1) * CELL - ROAD_W * 0.55;
      const z = (j + 0.5) * CELL + (this.rng() - 0.5) * 6;
      const y = 7.5 + this.rng() * 4;
      const pts = [
        new THREE.Vector3(x0, y, z),
        new THREE.Vector3((x0 + x1) / 2, y - 1.3, z),
        new THREE.Vector3(x1, y, z),
      ];
      const curve = new THREE.CatmullRomCurve3(pts);
      this.group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(10)), lineMat));
      for (let k = 1; k <= 3; k++) {
        const p = curve.getPoint(k / 4);
        const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 6), lanterns[k % lanterns.length]!);
        lantern.position.copy(p);
        this.group.add(lantern);
      }
    }
  }

  private addStreetBanners() {
    for (let n = 0; n < 22; n++) {
      const j = Math.floor(this.rng() * GRID_N);
      const i = 0.5 + Math.floor(this.rng() * (GRID_N - 1));
      const shop = RESTAURANTS[Math.floor(this.rng() * RESTAURANTS.length)]!;
      const hue = 180 + this.rng() * 160;
      this.addNeon(shop, hue, i * CELL, 8.2, j * CELL, 0);
    }
  }

  private placePois() {
    this.restaurants.push(...RESTAURANT_NODES.map((r) => ({ ...r })));
    this.customers.push(...CUSTOMER_NODES.map((c) => ({ ...c })));
  }

  private scatterAlong(route: Route, pickupName?: string, dropoffName?: string, difficulty = 1) {
    const avoid = (s: number) =>
      Math.abs(s - route.pickupS) < 14 ||
      Math.abs(s - route.dropoffS) < 14 ||
      route.turns.some((t) => Math.abs(t.s - s) < 10);

    const gap = Math.max(9, 17.5 - difficulty * 1.35);
    const patterns = ["weave", "jump", "slide", "squeeze", "car", "mix"] as const;
    let s = 26;
    while (s < route.length - 16) {
      if (avoid(s)) {
        s += 8;
        continue;
      }
      const p = patterns[Math.floor(this.rng() * patterns.length)]!;
      if (p === "weave") {
        this.addObs("cone", s, -2.5);
        this.addObs("cone", s + 4.5, 2.5);
        this.addObs("barrier", s + 9, this.rng() > 0.5 ? -2.1 : 2.1);
        s += 14 + gap * 0.55;
      } else if (p === "jump") {
        this.addObs("barrier", s, 0);
        s += 10 + gap * 0.45;
      } else if (p === "slide") {
        this.addObs("hang", s, 0);
        s += 10 + gap * 0.45;
      } else if (p === "squeeze") {
        this.addObs("car", s, -2.7);
        this.addObs("cone", s, 2.5);
        s += 12 + gap * 0.4;
      } else if (p === "car") {
        this.addObs("car", s, this.rng() > 0.5 ? 2.3 : -2.3);
        s += 11 + gap * 0.5;
      } else {
        this.addObs(this.rng() > 0.5 ? "barrier" : "cone", s, (this.rng() - 0.5) * 5.4);
        s += gap;
      }
      if (difficulty > 2.2 && this.rng() > 0.55 && s < route.length - 18 && !avoid(s)) {
        this.addObs("hang", s + 3.5, 0);
        s += 8;
      }
    }

    if (pickupName) this.placeGate("pickup", route.pickupS, pickupName);
    if (dropoffName) this.placeGate("dropoff", route.dropoffS, dropoffName);
  }

  private addObs(kind: Obstacle["kind"], s: number, lateral: number) {
    if (!this.route) return;
    const halfW = kind === "car" ? 1.1 : kind === "hang" ? 1.55 : kind === "cone" ? 0.55 : 1.15;
    this.obstacles.push({
      kind,
      s,
      lateral,
      halfW,
      depth: kind === "car" ? 3 : 1.3,
      hit: false,
      dodged: false,
    });
    const sm = this.route.at(s);
    this.spawnObstacleMesh(kind, sm.x + sm.rx * lateral, sm.z + sm.rz * lateral, sm.yaw);
  }

  private placeGate(kind: Gate["kind"], s: number, name: string) {
    if (!this.route) return;
    const gate: Gate = { kind, s, name, used: false };
    this.gates.push(gate);
    const sm = this.route.at(s);
    const color = kind === "pickup" ? 0x3df0ff : 0xff2d95;
    const arch = new THREE.Group();
    const postMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.4 });
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.22, 3.8, 0.22), postMat);
    left.position.set(-4.3, 1.9, 0);
    const right = new THREE.Mesh(new THREE.BoxGeometry(0.22, 3.8, 0.22), postMat);
    right.position.set(4.3, 1.9, 0);
    const top = new THREE.Mesh(new THREE.BoxGeometry(8.9, 0.22, 0.22), postMat);
    top.position.set(0, 3.75, 0);
    arch.add(left, right, top);
    const beam = new THREE.Mesh(
      new THREE.PlaneGeometry(8.6, 3.6),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.12,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    beam.position.y = 1.8;
    arch.add(beam);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(5.6, 1.2),
      new THREE.MeshBasicMaterial({
        map: makeNeonSign(kind === "pickup" ? `取餐 · ${name}` : `送达 · ${name}`, kind === "pickup" ? 186 : 320),
        transparent: true,
        toneMapped: false,
      }),
    );
    sign.position.set(0, 4.45, 0);
    arch.add(sign);
    const light = new THREE.PointLight(color, 6.5, 18);
    light.position.set(0, 2.8, 0);
    arch.add(light);
    arch.position.set(sm.x, 0, sm.z);
    arch.rotation.y = sm.yaw;
    this.group.add(arch);
    this.gateMeshes.push(arch);
  }

  private spawnObstacleMesh(kind: Obstacle["kind"], x: number, z: number, yaw: number) {
    const g = new THREE.Group();
    if (kind === "barrier") {
      const m = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.05, 0.55), this.stripeMat);
      m.position.y = 0.52;
      const band = new THREE.Mesh(
        new THREE.BoxGeometry(2.35, 0.18, 0.58),
        new THREE.MeshStandardMaterial({ color: 0xfff4e0 }),
      );
      band.position.y = 0.72;
      g.add(m, band);
    } else if (kind === "car") {
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 3.1), this.carMats[Math.floor(this.rng() * this.carMats.length)]!);
      body.position.y = 0.55;
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 1.5), this.glassMat);
      cabin.position.set(0, 1.05, -0.15);
      const light = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 0.12, 0.08),
        new THREE.MeshStandardMaterial({ color: 0xfff2c8, emissive: 0xffe9a0, emissiveIntensity: 2 }),
      );
      light.position.set(0, 0.55, 1.56);
      const tail = new THREE.Mesh(
        new THREE.BoxGeometry(1.3, 0.1, 0.08),
        new THREE.MeshStandardMaterial({ color: 0xff2244, emissive: 0xff2244, emissiveIntensity: 1.6 }),
      );
      tail.position.set(0, 0.55, -1.56);
      g.add(body, cabin, light, tail);
    } else if (kind === "hang") {
      const left = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.1, 0.16), this.postMat);
      left.position.set(-1.5, 1.05, 0);
      const right = left.clone();
      right.position.x = 1.5;
      const bar = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.22, 0.22), this.hangMat);
      bar.position.y = 1.92;
      const glow = new THREE.Mesh(
        new THREE.BoxGeometry(3.3, 0.08, 0.08),
        new THREE.MeshBasicMaterial({ color: 0x3df0ff, toneMapped: false }),
      );
      glow.position.y = 1.92;
      g.add(left, right, bar, glow);
    } else {
      const m = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.05, 8), this.coneMat);
      m.position.y = 0.52;
      const stripe = new THREE.Mesh(
        new THREE.CylinderGeometry(0.44, 0.44, 0.12, 8),
        new THREE.MeshStandardMaterial({ color: 0xfff4e0 }),
      );
      stripe.position.y = 0.55;
      g.add(m, stripe);
    }
    g.position.set(x, 0, z);
    g.rotation.y = yaw;
    this.group.add(g);
    this.gateMeshes.push(g);
  }
}
