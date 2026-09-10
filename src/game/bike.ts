import * as THREE from "three";
import { ROAD_HALF, RUNNER } from "./config";
import type { Input } from "./input";
import { clamp, lerp } from "./rng";
import type { Route } from "./path";
import { makeLogoTexture } from "./textures";
import type { PlayerStats, Sample } from "./types";

export class Rider {
  readonly group = new THREE.Group();
  s = 0;
  lateral = 0;
  yaw = 0;
  speed = RUNNER.baseSpeed;
  y = 0;
  vy = 0;
  jumping = false;
  sliding = false;
  slideT = 0;
  invuln = 0;
  shake = 0;
  firstPerson = false;
  route: Route | null = null;

  // 摔车状态:0=正常,>0=倒地中(秒)
  crashT = 0;
  // 货箱晃动
  private boxWobble = 0;
  private boxTilt = 0;
  // 转向手把 IK
  private steerAngle = 0;
  // 上次落地检测
  private wasGrounded = true;

  private body: THREE.Group;
  private cargoGroup: THREE.Group;
  private handlebar: THREE.Group;
  private wheels: THREE.Mesh[] = [];
  private wheelSpin = [0, 0];
  private lamp: THREE.SpotLight;
  private headMesh: THREE.Object3D;
  private visorMat: THREE.MeshStandardMaterial;
  private lampMat: THREE.MeshStandardMaterial;
  private lateralV = 0;

  constructor() {
    this.body = new THREE.Group();
    this.group.add(this.body);

    // ===== 统一 LowPoly 赛博中国风:硬边几何 + 少量多边形 + 强 emissive 点缀 =====

    // 调色板:深青底色 + 橙红品牌色 + 青色发光带 + 深灰金属件
    const paint = new THREE.MeshStandardMaterial({ color: 0x0f1622, metalness: 0.65, roughness: 0.32 });
    const orange = new THREE.MeshStandardMaterial({
      color: 0xff6a1a,
      emissive: 0x4a1600,
      emissiveIntensity: 0.55,
      roughness: 0.4,
    });
    const orangeBright = new THREE.MeshStandardMaterial({
      color: 0xff8a3a,
      emissive: 0xff6a1a,
      emissiveIntensity: 0.9,
      roughness: 0.35,
    });
    const jacket = new THREE.MeshStandardMaterial({ color: 0xff7a28, roughness: 0.62 });
    const jacketTrim = new THREE.MeshStandardMaterial({
      color: 0x3df0ff,
      emissive: 0x3df0ff,
      emissiveIntensity: 1.6,
      roughness: 0.4,
    });
    const dark = new THREE.MeshStandardMaterial({ color: 0x0a0e16, roughness: 0.35, metalness: 0.5 });
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x080808, roughness: 0.65, metalness: 0.15 });
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0x6a7a8a,
      metalness: 0.85,
      roughness: 0.2,
      emissive: 0x1a2030,
      emissiveIntensity: 0.3,
    });

    // === 车身(电动车) ===
    // 踏板底座:扁平硬边
    const deck = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.1, 2.0), paint);
    deck.position.y = 0.42;
    this.body.add(deck);

    // 车架:前后斜面拼成硬边轮廓
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.24, 1.25), paint);
    chassis.position.set(0, 0.66, 0.1);
    this.body.add(chassis);

    // 车头柱(转向柱,可转动)
    this.handlebar = new THREE.Group();
    this.handlebar.position.set(0, 0.92, 0.55);
    this.body.add(this.handlebar);

    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 6), dark);
    stem.position.y = 0.2;
    this.handlebar.add(stem);

    // 手把:横杆 + 两端握把
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.78, 6), dark);
    bar.rotation.z = Math.PI / 2;
    bar.position.y = 0.42;
    this.handlebar.add(bar);

    const gripL = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 8), orangeBright);
    gripL.rotation.z = Math.PI / 2;
    gripL.position.set(-0.4, 0.42, 0);
    this.handlebar.add(gripL);
    const gripR = gripL.clone();
    gripR.position.x = 0.4;
    this.handlebar.add(gripR);

    // === 货箱(可晃动) ===
    this.cargoGroup = new THREE.Group();
    this.cargoGroup.position.set(0, 1.1, -0.78);
    this.body.add(this.cargoGroup);

    const box = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.72, 0.72), orange);
    box.position.y = 0;
    this.cargoGroup.add(box);

    // 货箱边角发光条(LowPoly 风格的视觉点)
    const trim = new THREE.Mesh(
      new THREE.BoxGeometry(0.92, 0.04, 0.76),
      jacketTrim,
    );
    trim.position.y = 0.35;
    this.cargoGroup.add(trim);
    const trimB = trim.clone();
    trimB.position.y = -0.35;
    this.cargoGroup.add(trimB);

    // 货箱 Logo(背面)
    const logo = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5, 0.5),
      new THREE.MeshBasicMaterial({ map: makeLogoTexture(), toneMapped: false }),
    );
    logo.position.set(0, 0, -0.37);
    logo.rotation.y = Math.PI;
    this.cargoGroup.add(logo);

    // 货箱封带
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.78, 0.04), dark);
    this.cargoGroup.add(strap);

    // === 骑手 ===
    // 身体:胶囊,加青色腰条
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.5, 4, 8), jacket);
    torso.position.set(0, 1.32, 0.1);
    this.body.add(torso);

    const belt = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.04, 0.42),
      jacketTrim,
    );
    belt.position.set(0, 1.04, 0.1);
    this.body.add(belt);

    // 手臂:IK 简化,朝前伸(抓车把)
    const armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.3, 3, 6), jacket);
    armL.position.set(-0.26, 1.28, 0.36);
    armL.rotation.x = -0.8;
    this.body.add(armL);
    const armR = armL.clone();
    armR.position.x = 0.26;
    this.body.add(armR);

    // 头部:球 + 头盔檐 + 面罩
    this.headMesh = new THREE.Group();
    this.headMesh.position.set(0, 1.92, 0.18);
    this.body.add(this.headMesh);

    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), dark);
    this.headMesh.add(helm);
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.04, 0.16), dark);
    brim.position.set(0, 0.04, 0.18);
    this.headMesh.add(brim);

    this.visorMat = new THREE.MeshStandardMaterial({
      color: 0x3df0ff,
      emissive: 0x3df0ff,
      emissiveIntensity: 1.5,
      roughness: 0.2,
      metalness: 0.5,
    });
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.06), this.visorMat);
    visor.position.set(0, -0.02, 0.22);
    this.headMesh.add(visor);

    // === 车轮 ===
    const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.13, 16);
    const wheelPos = [0.8, -0.74];
    for (let i = 0; i < 2; i++) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(0, 0.4, wheelPos[i]);
      this.body.add(w);
      this.wheels.push(w);

      const rim = new THREE.Mesh(
        new THREE.CylinderGeometry(0.17, 0.17, 0.15, 8),
        rimMat,
      );
      rim.rotation.z = Math.PI / 2;
      rim.position.set(0, 0.4, wheelPos[i]);
      this.body.add(rim);

      // 辐条:5 条,简单硬边
      const spokes = new THREE.Group();
      for (let k = 0; k < 5; k++) {
        const s = new THREE.Mesh(
          new THREE.BoxGeometry(0.04, 0.32, 0.04),
          rimMat,
        );
        s.rotation.x = (k / 5) * Math.PI;
        spokes.add(s);
      }
      spokes.position.set(0, 0.4, wheelPos[i]);
      spokes.rotation.z = Math.PI / 2;
      this.body.add(spokes);
      // 用引用指向 spokes 后,把它存进 wheel 里以便同步转动
      (w as any)._spokes = spokes;
    }

    // === 车灯 ===
    this.lampMat = new THREE.MeshStandardMaterial({
      color: 0xfff4d2,
      emissive: 0xfff0c8,
      emissiveIntensity: 2.4,
    });
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.06), this.lampMat);
    lamp.position.set(0, 0.78, 1.05);
    this.handlebar.add(lamp);

    this.lamp = new THREE.SpotLight(0xfff2d8, 12, 36, 0.55, 0.32);
    this.lamp.position.set(0, 1.05, 0.9);
    this.lamp.target.position.set(0, 0.3, 9);
    this.body.add(this.lamp);
    this.body.add(this.lamp.target);
    const fill = new THREE.PointLight(0xffc8a0, 2.2, 12);
    fill.position.set(0, 2.4, 0);
    this.body.add(fill);

    // 刹车尾灯
    const tailMat = new THREE.MeshStandardMaterial({
      color: 0xff2244,
      emissive: 0xff2244,
      emissiveIntensity: 1.2,
    });
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.04), tailMat);
    tail.position.set(0, 0.7, -1.05);
    this.body.add(tail);
  }

  get x() {
    return this.group.position.x;
  }
  get z() {
    return this.group.position.z;
  }

  sample(): Sample | null {
    return this.route ? this.route.at(this.s) : null;
  }

  setRoute(route: Route) {
    this.route = route;
    this.s = 0.2;
    this.lateral = 0;
    this.speed = RUNNER.baseSpeed;
    this.applyPose();
  }

  jump() {
    if (this.jumping || this.sliding || this.crashT > 0) return false;
    this.jumping = true;
    this.vy = RUNNER.jump;
    return true;
  }

  slide() {
    if (this.jumping || this.sliding || this.crashT > 0) return false;
    this.sliding = true;
    this.slideT = RUNNER.slideTime;
    return true;
  }

  crash() {
    if (this.crashT > 0) return;
    this.invuln = RUNNER.invuln;
    this.shake = 0.5;
    this.speed *= 0.45;
    this.crashT = 0.9; // 倒地 0.9 秒
    this.boxWobble = 1.0; // 货箱剧烈晃动
  }

  /** 由外部粒子系统调用:返回是否刚落地 */
  consumeLanding() {
    if (this.wasGrounded || this.y > 0.05) return false;
    this.wasGrounded = true;
    return true;
  }

  update(dt: number, input: Input, stats: PlayerStats, heavy: boolean, raining = false, idle = false) {
    if (input.consume("Space")) this.jump();
    if (input.consume("KeyS") || input.consume("ControlLeft") || input.consume("ArrowDown")) this.slide();

    const axis = input.axis();
    this.lateralV = lerp(this.lateralV, -axis.x * RUNNER.strafe, 1 - Math.pow(0.04, dt));
    this.lateral = clamp(this.lateral + this.lateralV * dt, -ROAD_HALF, ROAD_HALF);

    const boost = input.down("ShiftLeft") || input.down("ShiftRight");
    const tired = stats.stamina <= 1;
    let target =
      Math.min(RUNNER.maxSpeed, RUNNER.baseSpeed + stats.combo * 0.18) *
        (heavy ? 0.82 : 1) *
        (tired ? 0.7 : 1) *
        (raining ? 0.88 : 1) +
      (boost && !tired ? RUNNER.boost : 0);
    if (idle) target = this.route && this.s < this.route.length - 1 ? 5.5 : 0;
    // 摔车中强制减速
    if (this.crashT > 0) target = 0;

    this.speed = lerp(this.speed, target, 1 - Math.pow(0.08, dt));
    if (this.route && this.crashT <= 0) {
      this.s = Math.min(this.route.length, this.s + this.speed * dt);
    }

    this.vy -= RUNNER.gravity * dt;
    this.y += this.vy * dt;
    if (this.y <= 0) {
      if (this.y < 0 || this.vy < 0) this.wasGrounded = false;
      this.y = 0;
      this.vy = 0;
      this.jumping = false;
    }
    if (this.sliding) {
      this.slideT -= dt;
      if (this.slideT <= 0) this.sliding = false;
    }

    this.invuln = Math.max(0, this.invuln - dt);
    this.shake = Math.max(0, this.shake - dt);
    this.crashT = Math.max(0, this.crashT - dt);
    this.boxWobble = Math.max(0, this.boxWobble - dt * 1.5);
    this.applyPose();

    // 手把随横向速度反向转(左移则车头右摆,模拟反向把)
    this.steerAngle = lerp(this.steerAngle, -this.lateralV * 0.08, 1 - Math.pow(0.05, dt));
    this.handlebar.rotation.y = this.steerAngle;

    // 侧倾:速度越大倾角越小(防眩晕),低速可大幅压弯
    const tiltScale = 0.04 + clamp(1 - this.speed / RUNNER.maxSpeed, 0, 1) * 0.04;
    this.body.rotation.z = lerp(this.body.rotation.z, this.lateralV * tiltScale, 1 - Math.pow(0.03, dt));
    this.body.rotation.x = lerp(this.body.rotation.x, this.sliding ? 0.55 : this.jumping ? -0.12 : 0, 10 * dt);
    this.body.position.y = this.sliding ? -0.28 : 0;

    // 摔车倒地动画:绕前轴旋转 70 度
    if (this.crashT > 0) {
      const p = 1 - this.crashT / 0.9;
      const fall = Math.min(1, p * 1.5);
      this.body.rotation.x = lerp(this.body.rotation.x, 1.22 * fall, 0.3);
      this.body.visible = true;
    } else {
      // 闪烁无敌
      this.body.visible = this.invuln <= 0 || Math.floor(this.invuln * 18) % 2 === 0;
    }

    // 货箱弹簧晃动:碰撞后摆动,平时随横向加速度轻微晃
    const lastLatV = (this as any)._lastLatV ?? this.lateralV;
    const lateralAccel = (this.lateralV - lastLatV) / dt;
    (this as any)._lastLatV = this.lateralV;
    this.boxTilt = lerp(this.boxTilt, Math.sin(performance.now() * 0.003) * 0.04 + lateralAccel * 0.003, 0.1);
    const wobble = this.boxWobble * Math.sin(performance.now() * 0.02) * 0.4;
    this.cargoGroup.rotation.x = this.boxTilt + wobble;
    this.cargoGroup.rotation.z = wobble * 0.6;

    // 头部随转向略微偏
    this.headMesh.rotation.z = this.steerAngle * 0.4;

    // 车轮旋转 + 辐条同步
    for (let i = 0; i < 2; i++) {
      this.wheelSpin[i] += this.speed * dt * 2.8;
      this.wheels[i].rotation.x = this.wheelSpin[i];
      const spokes = (this.wheels[i] as any)._spokes as THREE.Group | undefined;
      if (spokes) spokes.rotation.x = this.wheelSpin[i];
    }

    stats.battery = clamp(stats.battery - this.speed * 0.012 * dt, 0, 100);
    if (boost) stats.stamina = clamp(stats.stamina - 14 * dt, 0, 100);
    else stats.stamina = clamp(stats.stamina + 7 * dt, 0, 100);
    if (stats.battery <= 0) this.speed *= 0.92;
  }

  private applyPose() {
    const sm = this.sample();
    if (!sm) return;
    this.yaw = sm.yaw;
    this.group.position.set(sm.x + sm.rx * this.lateral, this.y, sm.z + sm.rz * this.lateral);
    this.group.rotation.y = this.yaw;
  }

  followCamera(camera: THREE.PerspectiveCamera, dt: number) {
    const sm = this.sample();
    const shakeX = (Math.random() - 0.5) * this.shake * 0.9;
    const shakeY = (Math.random() - 0.5) * this.shake * 0.45;
    const tx = sm?.tx ?? 0;
    const tz = sm?.tz ?? 1;
    const rx = sm?.rx ?? 1;
    const rz = sm?.rz ?? 0;
    const px = this.group.position.x;
    const py = this.group.position.y;
    const pz = this.group.position.z;
    const wantFov = this.firstPerson ? 72 : 58 + Math.max(0, this.speed - 12) * 0.75;
    camera.fov = lerp(camera.fov, wantFov, 1 - Math.pow(0.08, dt));
    camera.updateProjectionMatrix();
    if (this.firstPerson) {
      camera.position.lerp(new THREE.Vector3(px, py + 1.62, pz), 1 - Math.pow(0.001, dt));
      camera.lookAt(px + tx * 12, py + 1.25, pz + tz * 12);
      return;
    }
    const back = 6.5;
    const target = new THREE.Vector3(
      px - tx * back + rx * 0.2 + shakeX,
      py + 3.25 + shakeY,
      pz - tz * back + rz * 0.2,
    );
    camera.position.lerp(target, 1 - Math.pow(0.00025, dt));
    camera.lookAt(px + tx * 13, py + 1.05, pz + tz * 13);
  }
}
