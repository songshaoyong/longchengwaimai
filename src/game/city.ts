import * as THREE from "three";
import { CELL, CITY_SPAN, GRID_N, RESTAURANTS, RIBBON_MAX, ROAD_W, MOTOR_HALF, GREEN_W, LANE_W, BIKE_LANE, HUTONG_W } from "./config";
import { CUSTOMER_NODES, RESTAURANT_NODES } from "../data/catalog";
import { makeFacadeMaps, makeNeonSign, makeRoadTexture, makeSidewalkTexture, makeShopFrontMaps } from "./textures";
import { mulberry32 } from "./rng";
import { Route, buildLeg, hasHutong, hutongName } from "./path";
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
  private shopMats: THREE.MeshStandardMaterial[] = [];
  private roadMat!: THREE.MeshStandardMaterial;
  private laneMat!: THREE.MeshStandardMaterial;
  private greenMat!: THREE.MeshStandardMaterial;
  private walkMat!: THREE.MeshStandardMaterial;
  private groundMat!: THREE.MeshStandardMaterial;
  private hutongMat!: THREE.MeshStandardMaterial;
  private hutongRoadMat!: THREE.MeshStandardMaterial;
  private courtyardMat!: THREE.MeshStandardMaterial;
  private lampLights: THREE.PointLight[] = [];
  private bulbMat!: THREE.MeshStandardMaterial;
  private neonGlows: THREE.MeshBasicMaterial[] = [];
  private lanternMats: THREE.MeshStandardMaterial[] = [];
  private skylineMat!: THREE.MeshStandardMaterial;
  // 动态层
  private flickerSigns: { mat: THREE.MeshBasicMaterial; phase: number; base: number; amp: number }[] = [];
  private swingLanterns: { mesh: THREE.Object3D; pivot: THREE.Vector3; phase: number; amp: number }[] = [];
  private windowFlicker: { mats: THREE.MeshStandardMaterial[]; nextSwitch: number; base: number }[] = [];
  private chimneyPts: { mesh: THREE.Mesh; phase: number }[] = [];

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
    // 非机动车道:深色沥青,带白色边线
    const laneMat = new THREE.MeshStandardMaterial({
      color: 0x3a3d44,
      roughness: 0.55,
      metalness: 0.2,
    });
    this.laneMat = laneMat;
    // 绿化带:深绿
    const greenMat = new THREE.MeshStandardMaterial({
      color: 0x1a3a20,
      roughness: 0.9,
      metalness: 0.05,
    });
    this.greenMat = greenMat;
    const walkTex = makeSidewalkTexture();
    walkTex.repeat.set(CITY_SPAN / 4, 2);
    const walkMat = new THREE.MeshStandardMaterial({
      map: walkTex,
      roughness: 0.82,
      color: 0x6a5c55,
    });
    this.walkMat = walkMat;
    this.hutongRoadMat = new THREE.MeshStandardMaterial({
      color: 0x2a2c32,
      roughness: 0.7,
      metalness: 0.12,
    });
    this.hutongMat = new THREE.MeshStandardMaterial({
      color: 0x6a6e74,
      roughness: 0.92,
      metalness: 0.05,
    });
    this.courtyardMat = new THREE.MeshStandardMaterial({
      color: 0x8a8580,
      roughness: 0.88,
      metalness: 0.04,
    });
    const facades = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
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
    // 底商立面：暖橱窗，贴在楼块临街一层
    this.shopMats = [0, 1, 2, 3, 4].map((i) => {
      const maps = makeShopFrontMaps(mulberry32(501 + i * 23));
      return new THREE.MeshStandardMaterial({
        map: maps.map,
        emissiveMap: maps.emissiveMap,
        emissive: 0xffffff,
        emissiveIntensity: 0.95,
        roughness: 0.55,
        metalness: 0.08,
      });
    });
    // 注册窗户灭灯动画:每套材质随机间隔切换 emissive 强度
    for (const m of facades) {
      this.windowFlicker.push({ mats: [m], nextSwitch: 2 + this.rng() * 4, base: 1.15 });
    }
    for (const m of this.shopMats) {
      this.windowFlicker.push({ mats: [m], nextSwitch: 1.5 + this.rng() * 3, base: 0.95 });
    }
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

    // ===== 北京式横截面:机动车道 + 绿化带 + 非机动车道 + 人行道 =====
    const motorW = MOTOR_HALF * 2;     // 5.0
    const laneOffset = MOTOR_HALF + GREEN_W + LANE_W / 2; // 非机动车道中心到路中心的距离
    for (let j = 0; j < GRID_N; j++) {
      // 机动车道(中心)
      const motor = new THREE.Mesh(new THREE.PlaneGeometry(CITY_SPAN + ROAD_W, motorW), roadMat);
      motor.rotation.x = -Math.PI / 2;
      motor.position.set(CITY_SPAN / 2, 0.02, j * CELL);
      this.group.add(motor);
      // 两侧绿化带 + 非机动车道 + 人行道
      for (const side of [-1, 1]) {
        const gz = j * CELL + side * (MOTOR_HALF + GREEN_W / 2);
        const green = new THREE.Mesh(new THREE.PlaneGeometry(CITY_SPAN, GREEN_W), greenMat);
        green.rotation.x = -Math.PI / 2;
        green.position.set(CITY_SPAN / 2, 0.035, gz);
        this.group.add(green);
        // 非机动车道
        const lz = j * CELL + side * laneOffset;
        const lane = new THREE.Mesh(new THREE.PlaneGeometry(CITY_SPAN, LANE_W), laneMat);
        lane.rotation.x = -Math.PI / 2;
        lane.position.set(CITY_SPAN / 2, 0.025, lz);
        this.group.add(lane);
        // 非机动车道白色边线
        const lineMat = new THREE.MeshBasicMaterial({ color: 0xe8eef8, toneMapped: false });
        const edgeLine = new THREE.Mesh(new THREE.PlaneGeometry(CITY_SPAN, 0.06), lineMat);
        edgeLine.rotation.x = -Math.PI / 2;
        edgeLine.position.set(CITY_SPAN / 2, 0.03, lz + side * (LANE_W / 2 - 0.05));
        this.group.add(edgeLine);
        // 人行道(加宽)
        const wz = j * CELL + side * (laneOffset + LANE_W / 2 + 0.7);
        const walk = new THREE.Mesh(new THREE.PlaneGeometry(CITY_SPAN, 1.4), walkMat);
        walk.rotation.x = -Math.PI / 2;
        walk.position.set(CITY_SPAN / 2, 0.05, wz);
        this.group.add(walk);
      }
    }
    for (let i = 0; i < GRID_N; i++) {
      // 机动车道(纵向)
      const motor = new THREE.Mesh(new THREE.PlaneGeometry(motorW, CITY_SPAN + ROAD_W), roadMat);
      motor.rotation.x = -Math.PI / 2;
      motor.position.set(i * CELL, 0.025, CITY_SPAN / 2);
      this.group.add(motor);
      for (const side of [-1, 1]) {
        const gx = i * CELL + side * (MOTOR_HALF + GREEN_W / 2);
        const green = new THREE.Mesh(new THREE.PlaneGeometry(GREEN_W, CITY_SPAN), greenMat);
        green.rotation.x = -Math.PI / 2;
        green.position.set(gx, 0.04, CITY_SPAN / 2);
        this.group.add(green);
        const lx = i * CELL + side * laneOffset;
        const lane = new THREE.Mesh(new THREE.PlaneGeometry(LANE_W, CITY_SPAN), laneMat);
        lane.rotation.x = -Math.PI / 2;
        lane.position.set(lx, 0.03, CITY_SPAN / 2);
        this.group.add(lane);
        const lineMat = new THREE.MeshBasicMaterial({ color: 0xe8eef8, toneMapped: false });
        const edgeLine = new THREE.Mesh(new THREE.PlaneGeometry(0.06, CITY_SPAN), lineMat);
        edgeLine.rotation.x = -Math.PI / 2;
        edgeLine.position.set(lx + side * (LANE_W / 2 - 0.05), 0.035, CITY_SPAN / 2);
        this.group.add(edgeLine);
        const wx = i * CELL + side * (laneOffset + LANE_W / 2 + 0.7);
        const walk = new THREE.Mesh(new THREE.PlaneGeometry(1.4, CITY_SPAN), walkMat);
        walk.rotation.x = -Math.PI / 2;
        walk.position.set(wx, 0.055, CITY_SPAN / 2);
        this.group.add(walk);
      }
    }

    // 行道树:沿每条路两侧每隔 8 米种一棵国槐(InstancedMesh)
    this.addStreetTrees();

    this.addLamps();
    this.addSkyline();
    this.addCables();
    this.addStreetBanners();
    this.group.add(this.life.group);

    for (let i = 0; i < GRID_N - 1; i++) {
      for (let j = 0; j < GRID_N - 1; j++) {
        if (hasHutong(i, j)) this.addHutongBlock(i, j, facades[Math.floor(this.rng() * facades.length)]!);
        else this.addBuilding(i, j, facades[Math.floor(this.rng() * facades.length)]!);
      }
    }

    this.placePois();
    this.addCrosswalks();
    this.addManholeCovers();

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
      const laneLat = sm.hutong ? 0 : BIKE_LANE;
      this.dummy.position.set(sm.x + sm.rx * laneLat, 0.07, sm.z + sm.rz * laneLat);
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
    const t = performance.now() * 0.001;

    // 霓虹闪烁
    for (const f of this.flickerSigns) {
      const v = f.base + Math.sin(t * 4 + f.phase) * f.amp;
      f.mat.opacity = Math.max(0.05, v);
    }

    // 灯笼摆动(绕 X 轴小幅往复)
    for (const s of this.swingLanterns) {
      s.mesh.rotation.x = Math.sin(t * 1.6 + s.phase) * s.amp;
      s.mesh.rotation.z = Math.cos(t * 1.2 + s.phase) * s.amp * 0.5;
    }

    // 窗户随机灭灯:每过一段时间随机切一些材质 emissive 强度
    for (const wf of this.windowFlicker) {
      wf.nextSwitch -= dt;
      if (wf.nextSwitch <= 0) {
        wf.nextSwitch = 2 + Math.random() * 5;
        // 基于 base 做随机扰动,模拟"这栋楼今晚有人/没人"
        for (const m of wf.mats) {
          const jitter = 0.7 + Math.random() * 0.5;
          m.emissiveIntensity = wf.base * jitter;
        }
      }
    }

    // 烟囱烟团:循环上升 + 缩放
    for (const c of this.chimneyPts) {
      const phase = (t * 0.4 + c.phase) % 1;
      c.mesh.position.y += phase * 0.6 * dt * 6;
      if (phase > 0.95) {
        // 回到烟囱口
        const base = c.mesh.position.y - phase * 6;
        c.mesh.position.y = base + 0.05;
      }
      const mat = c.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.32 * (1 - phase);
      c.mesh.scale.setScalar(0.7 + phase * 0.8);
    }

    // 行道树风摆:树冠轻微旋转
    if (this.trees && this.treeCount > 0) {
      const dummy2 = new THREE.Object3D();
      for (let k = 0; k < this.treeCount; k++) {
        this.trees.getMatrixAt(k, dummy2.matrix);
        dummy2.matrix.decompose(dummy2.position, dummy2.quaternion, dummy2.scale);
        const sway = Math.sin(t * 1.2 + this.treePhases[k]!) * 0.06;
        dummy2.rotation.set(sway, 0, sway * 0.5);
        dummy2.updateMatrix();
        this.trees.setMatrixAt(k, dummy2.matrix);
      }
      this.trees.instanceMatrix.needsUpdate = true;
    }
  }

  setPeriod(night: number) {
    const day = 1 - night;
    const facadeBase = 0.07 + night * 1.12;
    for (const m of this.facadeMats) {
      m.color.setRGB(0.72 + night * 0.28, 0.66 + night * 0.3, 0.58 + night * 0.38);
      m.emissiveIntensity = facadeBase;
    }
    for (const m of this.shopMats) {
      m.emissiveIntensity = 0.55 + night * 0.85;
    }
    // 更新 windowFlicker 的基准
    for (const wf of this.windowFlicker) wf.base = facadeBase;
    // 同步夜间车灯长曝光线
    this.life.setPeriod(night);
    this.roadMat.color.setRGB(0.55 + night * 0.22, 0.56 + night * 0.22, 0.58 + night * 0.24);
    this.rainBaseRoughness = 0.55 - night * 0.33;
    this.rainBaseMetalness = 0.08 + night * 0.27;
    // 实际值 = base 应用 wet(若有外部 wet 调用则覆盖,这里只设 base)
    this.roadMat.roughness = this.rainBaseRoughness;
    this.roadMat.metalness = this.rainBaseMetalness;
    this.walkMat.color.setRGB(0.55 + day * 0.12, 0.48 + day * 0.08, 0.4);
    this.groundMat.color.setRGB(0.05 + day * 0.28, 0.07 + day * 0.32, 0.09 + day * 0.12);
    this.roofMat.color.setRGB(0.12 + day * 0.28, 0.14 + day * 0.28, 0.17 + day * 0.28);
    this.courtyardMat.color.setRGB(0.48 + day * 0.12, 0.46 + day * 0.1, 0.42 + day * 0.08);
    this.hutongMat.color.setRGB(0.35 + day * 0.12, 0.36 + day * 0.1, 0.38 + day * 0.08);
    this.hutongRoadMat.color.setRGB(0.14 + night * 0.08, 0.15 + night * 0.08, 0.17 + night * 0.1);
    this.bulbMat.emissiveIntensity = 0.12 + night * 2.3;
    for (const light of this.lampLights) light.intensity = 3.2 * night;
    for (const g of this.neonGlows) g.opacity = 0.04 + night * 0.16;
    for (const l of this.lanternMats) l.emissiveIntensity = 0.35 + night * 1.45;
    this.skylineMat.color.setRGB(0.08 + day * 0.32, 0.12 + day * 0.28, 0.16 + day * 0.28);
    this.skylineMat.emissiveIntensity = 0.08 + night * 0.18;
    this.awningMat.emissiveIntensity = 0.08 + night * 0.28;
  }

  /** 东西向胡同切开地块：灰墙四合院 + 4 米窄道（尺度断崖） */
  private addHutongBlock(i: number, j: number, mat: THREE.Material) {
    const size = CELL - ROAD_W - 1.4;
    const cx = (i + 0.5) * CELL;
    const cz = (j + 0.5) * CELL;
    const gap = HUTONG_W + 0.35;
    const halfLen = size / 2;
    const wingD = (size - gap) / 2;

    // 南北两进院落（矮灰墙，老城尺度）
    for (const side of [-1, 1] as const) {
      const wingH = 4.2 + this.rng() * 2.4;
      const wz = cz + side * (gap / 2 + wingD / 2);
      const wing = new THREE.Mesh(new THREE.BoxGeometry(size * 0.96, wingH, wingD), this.courtyardMat);
      wing.position.set(cx, wingH / 2, wz);
      this.group.add(wing);
      // 院墙压顶
      const cap = new THREE.Mesh(new THREE.BoxGeometry(size * 0.98, 0.22, wingD + 0.15), this.hutongMat);
      cap.position.set(cx, wingH + 0.1, wz);
      this.group.add(cap);
      // 偶发二层小楼贴在院落外侧
      if (this.rng() > 0.55) {
        const h2 = wingH + 3 + this.rng() * 4;
        const upper = new THREE.Mesh(new THREE.BoxGeometry(size * 0.55, h2 - wingH, wingD * 0.7), mat);
        upper.position.set(cx + (this.rng() - 0.5) * size * 0.2, (wingH + h2) / 2, wz);
        this.group.add(upper);
      }
    }

    // 胡同路面（比大街窄一截，略沉）
    const alleyLen = size + 1.2;
    const road = new THREE.Mesh(new THREE.PlaneGeometry(alleyLen, HUTONG_W), this.hutongRoadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(cx, 0.04, cz);
    this.group.add(road);
    // 两侧墙根线
    for (const side of [-1, 1] as const) {
      const curb = new THREE.Mesh(
        new THREE.BoxGeometry(alleyLen, 0.35, 0.18),
        this.hutongMat,
      );
      curb.position.set(cx, 0.18, cz + side * (HUTONG_W / 2 + 0.05));
      this.group.add(curb);
    }

    // 胡同口门墩 / 抱鼓石
    for (const end of [-1, 1] as const) {
      const px = cx + end * halfLen;
      for (const side of [-1, 1] as const) {
        const pier = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.1, 0.45), this.hutongMat);
        pier.position.set(px, 0.55, cz + side * (HUTONG_W / 2 + 0.35));
        this.group.add(pier);
        const drum = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), this.courtyardMat);
        drum.position.set(px, 1.2, cz + side * (HUTONG_W / 2 + 0.35));
        this.group.add(drum);
      }
      // 胡同名木牌
      if (end < 0 || this.rng() > 0.4) {
        const name = hutongName(i, j);
        this.addNeon(name, 30 + this.rng() * 25, px + end * 0.2, 2.4, cz, Math.PI / 2);
      }
    }

    // 墙根停电动车
    const bikeMat = new THREE.MeshStandardMaterial({ color: 0x1a2030, metalness: 0.4, roughness: 0.4 });
    for (let k = 0; k < 3; k++) {
      if (this.rng() > 0.45) continue;
      const bike = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.55, 1.1), bikeMat);
      bike.position.set(cx + (this.rng() - 0.5) * size * 0.7, 0.28, cz + (this.rng() > 0.5 ? 1 : -1) * (HUTONG_W / 2 + 0.55));
      bike.rotation.y = (this.rng() - 0.5) * 0.4;
      this.group.add(bike);
    }
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

    // 楼顶细节:随机加空调外机阵列 + 天线
    const acMat = new THREE.MeshStandardMaterial({ color: 0x6a7080, roughness: 0.6, metalness: 0.3 });
    if (this.rng() > 0.5) {
      const n = 1 + Math.floor(this.rng() * 3);
      for (let k = 0; k < n; k++) {
        const ac = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.7), acMat);
        ac.position.set(
          cx + (this.rng() - 0.5) * size * 0.7,
          h + 0.5,
          cz + (this.rng() - 0.5) * size * 0.7,
        );
        this.group.add(ac);
      }
    }
    if (this.rng() > 0.6) {
      // 天线:细长圆柱 + 顶端小球
      const antMat = new THREE.MeshStandardMaterial({ color: 0x1a1c22, metalness: 0.6, roughness: 0.4 });
      const antH = 3 + this.rng() * 4;
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, antH, 5), antMat);
      ant.position.set(cx + (this.rng() - 0.5) * size * 0.4, h + antH / 2, cz + (this.rng() - 0.5) * size * 0.4);
      this.group.add(ant);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), this.bulbMat);
      tip.position.set(ant.position.x, h + antH, ant.position.z);
      this.group.add(tip);
    }

    const awning = new THREE.Mesh(new THREE.BoxGeometry(size * 0.7, 0.12, 1.6), this.awningMat);
    awning.position.set(cx, 3.05, j * CELL + ROAD_W * 0.55 + 0.4);
    this.group.add(awning);

    // 临街底商：四面贴一层暖橱窗铺面（北京路两边小铺）
    this.addStorefronts(cx, cz, size);

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
    // 烟囱:楼顶小圆柱,加上升小烟团 mesh(动态层)
    if (this.rng() > 0.55) {
      const chimMat = new THREE.MeshStandardMaterial({ color: 0x12161c, roughness: 0.85 });
      const chim = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 1.8, 6), chimMat);
      chim.position.set(cx + size * 0.2, h + 1, cz + size * 0.22);
      this.group.add(chim);
      // 烟团:小球,会动态上飘
      const smokeMat = new THREE.MeshBasicMaterial({
        color: 0x6a6a78,
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
        toneMapped: false,
      });
      for (let s = 0; s < 3; s++) {
        const sm = new THREE.Mesh(new THREE.SphereGeometry(0.32, 6, 4), smokeMat);
        sm.position.set(cx + size * 0.2, h + 2 + s * 0.6, cz + size * 0.22);
        sm.scale.setScalar(0.7 + s * 0.15);
        this.group.add(sm);
        this.chimneyPts.push({ mesh: sm, phase: this.rng() * Math.PI * 2 + s });
      }
    }
  }

  private addStorefronts(cx: number, cz: number, size: number) {
    const shopH = 3.15;
    const depth = 0.35;
    const faceW = size * 0.92;
    const mat = this.shopMats[Math.floor(this.rng() * this.shopMats.length)]!;
    const half = size / 2;
    const faces: { x: number; z: number; rotY: number; alongX: boolean }[] = [
      { x: cx, z: cz - half - depth / 2, rotY: 0, alongX: true },
      { x: cx, z: cz + half + depth / 2, rotY: Math.PI, alongX: true },
      { x: cx - half - depth / 2, z: cz, rotY: Math.PI / 2, alongX: false },
      { x: cx + half + depth / 2, z: cz, rotY: -Math.PI / 2, alongX: false },
    ];
    for (const f of faces) {
      const geo = f.alongX
        ? new THREE.BoxGeometry(faceW, shopH, depth)
        : new THREE.BoxGeometry(depth, shopH, faceW);
      const shop = new THREE.Mesh(geo, mat);
      shop.position.set(f.x, shopH / 2, f.z);
      this.group.add(shop);

      // 门楣小招牌（朴素底商，不全是霓虹）
      if (this.rng() > 0.35) {
        const label =
          this.rng() > 0.55
            ? ["烟酒茶", "早点", "修车", "便利", "理发", "五金", "药店", "洗衣"][Math.floor(this.rng() * 8)]!
            : RESTAURANTS[Math.floor(this.rng() * RESTAURANTS.length)]!;
        const hue = 20 + this.rng() * 40;
        const sx = f.alongX ? f.x + (this.rng() - 0.5) * faceW * 0.35 : f.x + Math.sin(f.rotY) * 0.2;
        const sz = f.alongX ? f.z + Math.cos(f.rotY) * 0.2 : f.z + (this.rng() - 0.5) * faceW * 0.35;
        this.addNeon(label, hue, sx, shopH + 0.55, sz, f.rotY);
      }
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
    // 注册到闪烁列表(部分招牌会闪烁,部分稳定)
    if (this.rng() > 0.45) {
      this.flickerSigns.push({
        mat,
        phase: this.rng() * Math.PI * 2,
        base: 0.85 + this.rng() * 0.15,
        amp: 0.08 + this.rng() * 0.15,
      });
      this.flickerSigns.push({
        mat: glowMat,
        phase: this.rng() * Math.PI * 2,
        base: 0.16,
        amp: 0.06 + this.rng() * 0.1,
      });
    }
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
        // 灯笼用 Group,内部 mesh 偏置,这样旋转 Group 即可绕 pivot 摆动
        const lanternGroup = new THREE.Group();
        lanternGroup.position.copy(p);
        const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 6), lanterns[k % lanterns.length]!);
        // 灯笼稍下偏,模拟从挂点垂下
        lantern.position.y = -0.05;
        lanternGroup.add(lantern);
        // 顶部连接小环
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.06, 6), lineMat);
        cap.position.y = 0.18;
        lanternGroup.add(cap);
        this.group.add(lanternGroup);
        this.swingLanterns.push({
          mesh: lanternGroup,
          pivot: p.clone(),
          phase: this.rng() * Math.PI * 2,
          amp: 0.04 + this.rng() * 0.06,
        });
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
    // 给每家餐厅放一个标志性小建筑(老街坊风格:小屋顶 + 招牌柱 + 灯笼)
    for (const r of this.restaurants) {
      this.addRestaurantLandmark(r.name, r.node);
    }
  }

  private addRestaurantLandmark(name: string, node: GridNode) {
    const cx = node.i * CELL;
    const cz = node.j * CELL + ROAD_W * 0.55 + 1.5;
    // 招牌柱:细高方柱,顶上挂招牌
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x1a1c22, roughness: 0.7, metalness: 0.3 });
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4, 0.4), pillarMat);
    pillar.position.set(cx, 2, cz);
    this.group.add(pillar);
    // 招牌霓虹字
    const hue = 180 + Math.floor(Math.abs(name.charCodeAt(0) * 31) % 180);
    const signMat = new THREE.MeshBasicMaterial({
      map: makeNeonSign(name, hue),
      transparent: true,
      toneMapped: false,
    });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.85), signMat);
    sign.position.set(cx, 4.2, cz + 0.25);
    this.group.add(sign);
    // 注册闪烁
    this.flickerSigns.push({
      mat: signMat,
      phase: this.rng() * Math.PI * 2,
      base: 0.9,
      amp: 0.1,
    });
    // 顶上一个小灯笼
    const lanternMat = new THREE.MeshStandardMaterial({
      color: 0xff4d6a,
      emissive: 0xff4d6a,
      emissiveIntensity: 1.8,
    });
    this.lanternMats.push(lanternMat);
    const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 6), lanternMat);
    lantern.position.set(cx, 4.7, cz);
    this.group.add(lantern);
    // 招牌柱下基础
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.6), pillarMat);
    base.position.set(cx, 0.2, cz);
    this.group.add(base);
  }

  private addCrosswalks() {
    // 每个 grid 交叉路口画斑马线(横向+纵向各一组)
    const whiteMat = new THREE.MeshBasicMaterial({ color: 0xe8eef8, toneMapped: false });
    const stripeW = 0.4;
    const stripeL = 1.4;
    for (let i = 0; i < GRID_N; i++) {
      for (let j = 0; j < GRID_N; j++) {
        const cx = i * CELL;
        const cz = j * CELL;
        // 横向斑马线(在路口的两侧)
        for (const side of [-1, 1]) {
          for (let k = -2; k <= 2; k++) {
            const stripe = new THREE.Mesh(new THREE.PlaneGeometry(stripeW, stripeL), whiteMat);
            stripe.rotation.x = -Math.PI / 2;
            stripe.position.set(cx + k * 1.0, 0.05, cz + side * (ROAD_W * 0.5 + 0.7));
            this.group.add(stripe);
          }
        }
        // 纵向斑马线
        for (const side of [-1, 1]) {
          for (let k = -2; k <= 2; k++) {
            const stripe = new THREE.Mesh(new THREE.PlaneGeometry(stripeL, stripeW), whiteMat);
            stripe.rotation.x = -Math.PI / 2;
            stripe.position.set(cx + side * (ROAD_W * 0.5 + 0.7), 0.05, cz + k * 1.0);
            this.group.add(stripe);
          }
        }
      }
    }
  }

  private addManholeCovers() {
    // 在路段中点散布井盖
    const coverMat = new THREE.MeshStandardMaterial({ color: 0x3a4048, metalness: 0.7, roughness: 0.4 });
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x606870, toneMapped: false });
    for (let i = 0; i < GRID_N - 1; i++) {
      for (let j = 0; j < GRID_N; j++) {
        if (this.rng() > 0.55) continue;
        const cx = (i + 0.5) * CELL + (this.rng() - 0.5) * 4;
        const cz = j * CELL;
        const cover = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.04, 12), coverMat);
        cover.rotation.x = -Math.PI / 2;
        cover.position.set(cx, 0.04, cz);
        this.group.add(cover);
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.65, 12), ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(cx, 0.045, cz);
        this.group.add(ring);
      }
    }
  }

  private addStreetTrees() {
    // 国槐:树干(圆柱)+ 树冠(低多边形球),用 InstancedMesh 批量渲染
    const trunkGeo = new THREE.CylinderGeometry(0.12, 0.18, 2.8, 5);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3020, roughness: 0.9 });
    const canopyGeo = new THREE.IcosahedronGeometry(1.4, 1);
    const canopyMat = new THREE.MeshStandardMaterial({
      color: 0x2a5a30,
      roughness: 0.85,
      flatShading: true,
    });

    // 计算树的位置
    const treeOffset = MOTOR_HALF + GREEN_W + LANE_W + 0.8;
    const spacing = 11;
    const positions: { x: number; z: number; phase: number }[] = [];
    for (let j = 0; j < GRID_N; j++) {
      for (const side of [-1, 1]) {
        const z = j * CELL + side * treeOffset;
        for (let x = 6; x < CITY_SPAN - 6; x += spacing) {
          // 避开路口
          const nearIntersection = [...Array(GRID_N).keys()].some(
            (i) => Math.abs(x - i * CELL) < 4,
          );
          if (nearIntersection) continue;
          positions.push({ x: x + (this.rng() - 0.5) * 2, z, phase: this.rng() * Math.PI * 2 });
        }
      }
    }
    for (let i = 0; i < GRID_N; i++) {
      for (const side of [-1, 1]) {
        const x = i * CELL + side * treeOffset;
        for (let z = 6; z < CITY_SPAN - 6; z += spacing) {
          const nearIntersection = [...Array(GRID_N).keys()].some(
            (jj) => Math.abs(z - jj * CELL) < 4,
          );
          if (nearIntersection) continue;
          positions.push({ x, z: z + (this.rng() - 0.5) * 2, phase: this.rng() * Math.PI * 2 });
        }
      }
    }

    const n = positions.length;
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, n);
    const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, n);
    trunks.frustumCulled = false;
    canopies.frustumCulled = false;

    const dummy = new THREE.Object3D();
    for (let k = 0; k < n; k++) {
      const p = positions[k]!;
      // 树干
      dummy.position.set(p.x, 1.4, p.z);
      dummy.rotation.set(0, this.rng() * Math.PI, 0);
      const s = 0.85 + this.rng() * 0.3;
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      trunks.setMatrixAt(k, dummy.matrix);
      // 树冠
      dummy.position.set(p.x, 3.2 + this.rng() * 0.4, p.z);
      dummy.rotation.set(0, this.rng() * Math.PI, 0);
      const cs = (0.9 + this.rng() * 0.4) * s;
      dummy.scale.setScalar(cs);
      dummy.updateMatrix();
      canopies.setMatrixAt(k, dummy.matrix);
    }
    trunks.count = n;
    canopies.count = n;
    trunks.instanceMatrix.needsUpdate = true;
    canopies.instanceMatrix.needsUpdate = true;
    this.group.add(trunks, canopies);
    this.trees = canopies;
    this.treeCount = n;
    this.treePhases = positions.map((p) => p.phase);
  }

  private trees: THREE.InstancedMesh | null = null;
  private treeCount = 0;
  private treePhases: number[] = [];

  setWet(rain: number) {
    const r = this.rainBaseRoughness;
    const m = this.rainBaseMetalness;
    this.roadMat.roughness = r - rain * 0.35;
    this.roadMat.metalness = m + rain * 0.35;
  }
  private rainBaseRoughness = 0.55;
  private rainBaseMetalness = 0.08;

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
      const atHutong = Boolean(route.at(s).hutong);
      // 障碍相对非机动车道布置；胡同内只放锥桶，不塞汽车
      const bike = atHutong ? 0 : BIKE_LANE;
      if (atHutong) {
        this.addObs("cone", s, (this.rng() - 0.5) * 1.2);
        if (this.rng() > 0.55) this.addObs("cone", s + 3.5, (this.rng() - 0.5) * 1.0);
        s += 10 + gap * 0.6;
        continue;
      }
      if (p === "weave") {
        this.addObs("cone", s, bike - 0.9);
        this.addObs("cone", s + 4.5, bike + 0.85);
        this.addObs("barrier", s + 9, bike + (this.rng() > 0.5 ? -1.1 : 0.2));
        s += 14 + gap * 0.55;
      } else if (p === "jump") {
        this.addObs("barrier", s, bike);
        s += 10 + gap * 0.45;
      } else if (p === "slide") {
        this.addObs("hang", s, bike);
        s += 10 + gap * 0.45;
      } else if (p === "squeeze") {
        this.addObs("car", s, MOTOR_HALF * 0.55);
        this.addObs("cone", s, bike + 0.4);
        s += 12 + gap * 0.4;
      } else if (p === "car") {
        this.addObs("car", s, this.rng() > 0.5 ? MOTOR_HALF * 0.6 : -MOTOR_HALF * 0.4);
        s += 11 + gap * 0.5;
      } else {
        this.addObs(this.rng() > 0.5 ? "barrier" : "cone", s, bike + (this.rng() - 0.5) * 1.6);
        s += gap;
      }
      if (difficulty > 2.2 && this.rng() > 0.55 && s < route.length - 18 && !avoid(s)) {
        this.addObs("hang", s + 3.5, bike);
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
