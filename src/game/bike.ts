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
  private wheels: THREE.Mesh[] = [];
  private body: THREE.Group;
  private lateralV = 0;

  constructor() {
    this.body = new THREE.Group();
    this.group.add(this.body);

    const paint = new THREE.MeshStandardMaterial({ color: 0x1c2430, metalness: 0.55, roughness: 0.28 });
    const orange = new THREE.MeshStandardMaterial({
      color: 0xff6a1a,
      emissive: 0x4a1600,
      emissiveIntensity: 0.45,
    });
    const jacket = new THREE.MeshStandardMaterial({ color: 0xff7a28, roughness: 0.55 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x11161c, roughness: 0.35, metalness: 0.4 });

    const deck = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.12, 2.15), paint);
    deck.position.y = 0.52;
    this.body.add(deck);

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.28, 1.35), paint);
    chassis.position.set(0, 0.72, 0.12);
    this.body.add(chassis);

    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.85, 8), dark);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, 1.12, 0.72);
    this.body.add(bar);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.45, 6), dark);
    stem.position.set(0, 0.92, 0.55);
    this.body.add(stem);

    const box = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.78, 0.78), orange);
    box.position.set(0, 1.12, -0.78);
    this.body.add(box);
    const logo = new THREE.Mesh(
      new THREE.PlaneGeometry(0.55, 0.55),
      new THREE.MeshBasicMaterial({ map: makeLogoTexture(), toneMapped: false }),
    );
    logo.position.set(0, 1.12, -1.18);
    logo.rotation.y = Math.PI;
    this.body.add(logo);

    const rider = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.58, 4, 8), jacket);
    rider.position.set(0, 1.38, 0.12);
    this.body.add(rider);
    const armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.32, 3, 6), jacket);
    armL.position.set(-0.28, 1.28, 0.38);
    armL.rotation.x = -0.7;
    this.body.add(armL);
    const armR = armL.clone();
    armR.position.x = 0.28;
    this.body.add(armR);

    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 8), dark);
    helm.position.set(0, 1.92, 0.18);
    this.body.add(helm);
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.12, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x3df0ff, emissive: 0x3df0ff, emissiveIntensity: 1.3 }),
    );
    visor.position.set(0, 1.9, 0.36);
    this.body.add(visor);

    const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.14, 14);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.55 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0x8899aa, metalness: 0.7, roughness: 0.25 });
    for (const zOff of [0.78, -0.72]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(0, 0.4, zOff);
      this.body.add(w);
      this.wheels.push(w);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.16, 10), rimMat);
      rim.rotation.z = Math.PI / 2;
      rim.position.set(0, 0.4, zOff);
      this.body.add(rim);
    }

    const lamp = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.12, 0.08),
      new THREE.MeshStandardMaterial({ color: 0xfff4d2, emissive: 0xfff0c8, emissiveIntensity: 2.2 }),
    );
    lamp.position.set(0, 0.78, 1.12);
    this.body.add(lamp);

    const light = new THREE.SpotLight(0xfff2d8, 10, 32, 0.5, 0.35);
    light.position.set(0, 1.05, 1.0);
    light.target.position.set(0, 0.3, 9);
    this.body.add(light);
    this.body.add(light.target);
    const fill = new THREE.PointLight(0xffc8a0, 2.2, 12);
    fill.position.set(0, 2.4, 0);
    this.body.add(fill);
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
    if (this.jumping || this.sliding) return false;
    this.jumping = true;
    this.vy = RUNNER.jump;
    return true;
  }

  slide() {
    if (this.jumping || this.sliding) return false;
    this.sliding = true;
    this.slideT = RUNNER.slideTime;
    return true;
  }

  crash() {
    this.invuln = RUNNER.invuln;
    this.shake = 0.5;
    this.speed *= 0.45;
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

    this.speed = lerp(this.speed, target, 1 - Math.pow(0.08, dt));
    if (this.route) {
      this.s = Math.min(this.route.length, this.s + this.speed * dt);
    }

    this.vy -= RUNNER.gravity * dt;
    this.y += this.vy * dt;
    if (this.y <= 0) {
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
    this.applyPose();
    this.body.rotation.z = lerp(this.body.rotation.z, this.lateralV * 0.05, 1 - Math.pow(0.03, dt));
    this.body.rotation.x = lerp(this.body.rotation.x, this.sliding ? 0.55 : this.jumping ? -0.12 : 0, 10 * dt);
    this.body.position.y = this.sliding ? -0.28 : 0;
    this.body.visible = this.invuln <= 0 || Math.floor(this.invuln * 18) % 2 === 0;
    for (const w of this.wheels) w.rotation.x += this.speed * dt * 2.6;

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
