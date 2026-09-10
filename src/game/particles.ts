import * as THREE from "three";

type ParticleKind = "dust" | "spark" | "coin" | "smoke";

interface Particle {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  kind: ParticleKind;
  spin?: number;
  spinV?: number;
}

/**
 * 简易粒子系统:四类效果共用一个 InstancedMesh 池。
 * - dust:  落地尘土(浅褐色,圆环扩散)
 * - spark: 碰撞火花(亮黄,放射状)
 * - coin:  送达金币礼花(向上喷射,带重力)
 * - smoke: 高速漂移烟(灰白,向下飘)
 */
export class Particles {
  readonly group = new THREE.Group();
  private pool: Particle[] = [];
  private readonly max = 280;
  private mesh: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private clock = 0;

  // 每种类型不同的颜色
  private colors: Record<ParticleKind, THREE.Color> = {
    dust: new THREE.Color(0x8a7a5a),
    spark: new THREE.Color(0xffd070),
    coin: new THREE.Color(0xffe060),
    smoke: new THREE.Color(0xb0b0b8),
  };

  constructor() {
    // 用 SphereGeometry,instanceColor 上色
    const geo = new THREE.SphereGeometry(0.08, 6, 4);
    const mat = new THREE.MeshBasicMaterial({
      vertexColors: false,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      toneMapped: false,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, this.max);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    // instanceColor 初始化
    const colorAttr = new Float32Array(this.max * 3);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(colorAttr, 3);
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.group.add(this.mesh);
  }

  /** 在某点喷射尘土(骑手落地) */
  dust(x: number, y: number, z: number) {
    this.spawn(x, y, z, "dust", 14, {
      spread: 4,
      vyMin: 1,
      vyMax: 3,
      lifeMin: 0.25,
      lifeMax: 0.45,
      sizeMin: 0.15,
      sizeMax: 0.35,
    });
  }

  /** 碰撞火花:放射状 */
  spark(x: number, y: number, z: number) {
    this.spawn(x, y, z, "spark", 20, {
      spread: 8,
      vyMin: 1,
      vyMax: 5,
      lifeMin: 0.2,
      lifeMax: 0.5,
      sizeMin: 0.08,
      sizeMax: 0.2,
    });
  }

  /** 送达礼花:向上喷射 */
  coin(x: number, y: number, z: number) {
    this.spawn(x, y, z, "coin", 36, {
      spread: 3,
      vyMin: 6,
      vyMax: 11,
      lifeMin: 0.6,
      lifeMax: 1.2,
      sizeMin: 0.12,
      sizeMax: 0.22,
    });
  }

  /** 漂移烟雾 */
  smoke(x: number, y: number, z: number) {
    this.spawn(x, y, z, "smoke", 6, {
      spread: 0.6,
      vyMin: 0.2,
      vyMax: 1.2,
      lifeMin: 0.4,
      lifeMax: 0.8,
      sizeMin: 0.18,
      sizeMax: 0.4,
    });
  }

  private spawn(
    x: number,
    y: number,
    z: number,
    kind: ParticleKind,
    count: number,
    o: {
      spread: number;
      vyMin: number;
      vyMax: number;
      lifeMin: number;
      lifeMax: number;
      sizeMin: number;
      sizeMax: number;
    },
  ) {
    for (let i = 0; i < count; i++) {
      if (this.pool.length >= this.max) this.pool.shift();
      const ang = Math.random() * Math.PI * 2;
      const rad = Math.random() * o.spread;
      const vy = o.vyMin + Math.random() * (o.vyMax - o.vyMin);
      const life = o.lifeMin + Math.random() * (o.lifeMax - o.lifeMin);
      this.pool.push({
        pos: new THREE.Vector3(x, y, z),
        vel: new THREE.Vector3(
          Math.cos(ang) * rad,
          vy,
          Math.sin(ang) * rad,
        ),
        life,
        maxLife: life,
        size: o.sizeMin + Math.random() * (o.sizeMax - o.sizeMin),
        kind,
        spin: Math.random() * Math.PI,
        spinV: (Math.random() - 0.5) * 6,
      });
    }
  }

  update(dt: number) {
    this.clock += dt;
    if (this.pool.length === 0) {
      this.mesh.count = 0;
      return;
    }
    const g = 18; // 粒子重力
    for (let i = this.pool.length - 1; i >= 0; i--) {
      const p = this.pool[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.pool.splice(i, 1);
        continue;
      }
      p.vel.y -= g * dt;
      // 摩擦
      p.vel.multiplyScalar(0.96);
      // 烟雾上升反向(烟雾模拟向下飘)
      if (p.kind === "smoke") p.vel.y += 2.5 * dt;
      p.pos.addScaledVector(p.vel, dt);
    }

    // 写入 InstancedMatrix
    const n = this.pool.length;
    for (let i = 0; i < n; i++) {
      const p = this.pool[i];
      const t = p.life / p.maxLife;
      const scale = p.size * (p.kind === "coin" ? Math.min(1, t * 2) : t);
      this.dummy.position.copy(p.pos);
      this.dummy.rotation.set(p.spin ?? 0, 0, 0);
      this.dummy.scale.setScalar(scale);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      // 颜色随生命衰减
      const col = this.colors[p.kind].clone();
      col.multiplyScalar(t);
      this.mesh.setColorAt(i, col);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
