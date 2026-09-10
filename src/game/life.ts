import * as THREE from "three";
import { CELL, CITY_SPAN, GRID_N, ROAD_W } from "./config";
import { mulberry32 } from "./rng";

type Mover = {
  mesh: THREE.Object3D;
  axis: "x" | "z";
  dir: number;
  speed: number;
  lane: number;
};

export class CityLife {
  readonly group = new THREE.Group();
  private cars: Mover[] = [];
  private peds: Mover[] = [];
  private rng = mulberry32(77);
  // 夜间车灯拉成长曝光线
  private headTrails: THREE.Mesh[] = [];
  private tailTrails: THREE.Mesh[] = [];
  private headTrailMat: THREE.MeshBasicMaterial;
  private tailTrailMat: THREE.MeshBasicMaterial;
  private night = 0;

  constructor() {
    const carMats = [0xff3355, 0x33ddff, 0xffcc33, 0x7aa0c8, 0xf2f2f2, 0x2a2a32].map(
      (c) => new THREE.MeshStandardMaterial({ color: c, metalness: 0.55, roughness: 0.28 }),
    );
    const glass = new THREE.MeshStandardMaterial({
      color: 0x112233,
      roughness: 0.15,
      metalness: 0.7,
      emissive: 0x223344,
      emissiveIntensity: 0.25,
    });
    const head = new THREE.MeshStandardMaterial({ color: 0xfff2c8, emissive: 0xffe9a0, emissiveIntensity: 2.1 });
    const tail = new THREE.MeshStandardMaterial({ color: 0xff2244, emissive: 0xff2244, emissiveIntensity: 1.5 });

    // 长曝光线材质(顶/尾灯)
    this.headTrailMat = new THREE.MeshBasicMaterial({
      color: 0xfff0a0,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    this.tailTrailMat = new THREE.MeshBasicMaterial({
      color: 0xff2244,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });

    for (let j = 0; j < GRID_N; j++) {
      const n = 1 + (this.rng() > 0.4 ? 1 : 0);
      for (let k = 0; k < n; k++) {
        const dir = this.rng() > 0.5 ? 1 : -1;
        const mesh = this.makeCar(carMats, glass, head, tail);
        const x = this.rng() * CITY_SPAN;
        const z = j * CELL + dir * 1.8;
        mesh.position.set(x, 0, z);
        mesh.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        this.group.add(mesh);
        const mover = { mesh, axis: "x" as const, dir, speed: 7 + this.rng() * 6, lane: z };
        this.cars.push(mover);
        this.addTrails(mesh, "x", dir);
      }
    }
    for (let i = 0; i < GRID_N; i++) {
      const n = 1 + (this.rng() > 0.4 ? 1 : 0);
      for (let k = 0; k < n; k++) {
        const dir = this.rng() > 0.5 ? 1 : -1;
        const mesh = this.makeCar(carMats, glass, head, tail);
        const z = this.rng() * CITY_SPAN;
        const x = i * CELL - dir * 1.8;
        mesh.position.set(x, 0, z);
        mesh.rotation.y = dir > 0 ? 0 : Math.PI;
        this.group.add(mesh);
        const mover = { mesh, axis: "z" as const, dir, speed: 7 + this.rng() * 6, lane: x };
        this.cars.push(mover);
        this.addTrails(mesh, "z", dir);
      }
    }

    const clothes = [0x3a4a68, 0x6a3a4a, 0x2a5a58, 0x4a3a28, 0x1a2430].map(
      (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 }),
    );
    for (let n = 0; n < 70; n++) {
      const alongX = this.rng() > 0.5;
      const street = Math.floor(this.rng() * GRID_N);
      const side = this.rng() > 0.5 ? 1 : -1;
      const dir = this.rng() > 0.5 ? 1 : -1;
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.55, 3, 6), clothes[Math.floor(this.rng() * clothes.length)]!);
      body.position.y = 0.75;
      const headM = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), clothes[0]!);
      headM.position.y = 1.28;
      const g = new THREE.Group();
      g.add(body, headM);
      const pos = this.rng() * CITY_SPAN;
      if (alongX) {
        g.position.set(pos, 0, street * CELL + side * (ROAD_W * 0.55 + 0.5));
        g.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        this.peds.push({ mesh: g, axis: "x", dir, speed: 1.1 + this.rng() * 0.7, lane: g.position.z });
      } else {
        g.position.set(street * CELL + side * (ROAD_W * 0.55 + 0.5), 0, pos);
        g.rotation.y = dir > 0 ? 0 : Math.PI;
        this.peds.push({ mesh: g, axis: "z", dir, speed: 1.1 + this.rng() * 0.7, lane: g.position.x });
      }
      this.group.add(g);
    }
  }

  private addTrails(car: THREE.Group, axis: "x" | "z", dir: number) {
    // 顶灯长尾:在车前方延伸的薄片
    const headGeo = new THREE.PlaneGeometry(0.5, 4);
    const headTrail = new THREE.Mesh(headGeo, this.headTrailMat);
    headTrail.visible = false;
    // 尾灯长尾:在车后方延伸
    const tailGeo = new THREE.PlaneGeometry(0.4, 3);
    const tailTrail = new THREE.Mesh(tailGeo, this.tailTrailMat);
    tailTrail.visible = false;

    if (axis === "x") {
      // 沿 X 轴移动
      headTrail.rotation.x = -Math.PI / 2;
      headTrail.rotation.z = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      tailTrail.rotation.x = -Math.PI / 2;
      tailTrail.rotation.z = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      // 位置:车前方/后方
      headTrail.position.set(dir * 2.5, 0.55, 0);
      tailTrail.position.set(-dir * 2.5, 0.55, 0);
    } else {
      headTrail.rotation.x = -Math.PI / 2;
      tailTrail.rotation.x = -Math.PI / 2;
      headTrail.position.set(0, 0.55, dir * 2.5);
      tailTrail.position.set(0, 0.55, -dir * 2.5);
    }
    car.add(headTrail, tailTrail);
    this.headTrails.push(headTrail);
    this.tailTrails.push(tailTrail);
  }

  setPeriod(night: number) {
    this.night = night;
    const op = night * 0.55;
    this.headTrailMat.opacity = op;
    this.tailTrailMat.opacity = op;
    const visible = night > 0.3;
    for (const t of this.headTrails) t.visible = visible;
    for (const t of this.tailTrails) t.visible = visible;
  }

  update(dt: number) {
    const span = CITY_SPAN + 28;
    for (const m of this.cars) {
      if (m.axis === "x") {
        m.mesh.position.x += m.dir * m.speed * dt;
        if (m.mesh.position.x > span) m.mesh.position.x = -14;
        if (m.mesh.position.x < -14) m.mesh.position.x = span;
        m.mesh.position.z = m.lane;
      } else {
        m.mesh.position.z += m.dir * m.speed * dt;
        if (m.mesh.position.z > span) m.mesh.position.z = -14;
        if (m.mesh.position.z < -14) m.mesh.position.z = span;
        m.mesh.position.x = m.lane;
      }
    }
    for (const p of this.peds) {
      if (p.axis === "x") {
        p.mesh.position.x += p.dir * p.speed * dt;
        if (p.mesh.position.x > CITY_SPAN) p.dir = -1;
        if (p.mesh.position.x < 0) p.dir = 1;
        p.mesh.rotation.y = p.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        p.mesh.position.z += p.dir * p.speed * dt;
        if (p.mesh.position.z > CITY_SPAN) p.dir = -1;
        if (p.mesh.position.z < 0) p.dir = 1;
        p.mesh.rotation.y = p.dir > 0 ? 0 : Math.PI;
      }
    }
  }

  private makeCar(
    carMats: THREE.MeshStandardMaterial[],
    glass: THREE.MeshStandardMaterial,
    head: THREE.MeshStandardMaterial,
    tail: THREE.MeshStandardMaterial,
  ) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 3.1), carMats[Math.floor(this.rng() * carMats.length)]!);
    body.position.y = 0.55;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 1.5), glass);
    cabin.position.set(0, 1.05, -0.15);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 0.08), head);
    lamp.position.set(0, 0.55, 1.56);
    const stop = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.1, 0.08), tail);
    stop.position.set(0, 0.55, -1.56);
    g.add(body, cabin, lamp, stop);
    return g;
  }
}
