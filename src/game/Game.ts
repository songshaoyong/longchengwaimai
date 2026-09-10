import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { CELL, CITY_SPAN } from "./config";
import { CUSTOMER_LINES, CUSTOMER_WAIT, DISTRICT_1 } from "../data/catalog";
import { GameAudio } from "./audio";
import { Rider } from "./bike";
import { Track } from "./city";
import { Hud } from "./hud";
import { Input } from "./input";
import { OrderSystem } from "./orders";
import { buildLeg } from "./path";
import { clearSave, defaultSave, loadSave, snapshot, writeSave } from "./save";
import { paintSky, makeSkyTexture, makeCloudTexture } from "./textures";
import { duskFactor, nightFactor, periodName } from "./period";
import { Particles } from "./particles";
import type { GameMode, PlayerStats } from "./types";

export class Game {
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1400);
  private clock = new THREE.Clock();
  private sky: THREE.Mesh;
  private skyTex: THREE.CanvasTexture;
  private clouds: THREE.Mesh;
  private cloudMat: THREE.MeshBasicMaterial;
  private hemi: THREE.HemisphereLight;
  private sun: THREE.DirectionalLight;
  private neonM: THREE.PointLight;
  private neonC: THREE.PointLight;
  private neonA: THREE.PointLight;
  private lastPeriod = "";
  private lastSkyH = -99;
  private lastSkyRain = false;
  private fog = new THREE.FogExp2(0xb8cce0, 0.0028);
  private input = new Input();
  private audio = new GameAudio();
  private track = new Track();
  private rider = new Rider();
  private orders: OrderSystem;
  private hud = new Hud();
  private particles = new Particles();
  private mode: GameMode = "title";
  private holding = false;
  private raining = false;
  private rainClock = 18;
  private minutes = 10 * 60 + 20;
  private rain: THREE.LineSegments | null = null;
  private speedLines: THREE.LineSegments | null = null;
  private rainKnown = false;
  private resultT = 0;
  private stats: PlayerStats = {
    name: "阿龙",
    money: 0,
    goodReviews: 0,
    stamina: 100,
    battery: 100,
    combo: 0,
    bestCombo: 0,
    deliveries: 0,
  };
  private dlg: { who: string; text: string }[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.orders = new OrderSystem(this.track);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.scene.fog = this.fog;
    this.scene.background = new THREE.Color(0xb8cce0);
    this.hemi = new THREE.HemisphereLight(0xffe8c8, 0x6a7a48, 1.05);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff2d0, 1.35);
    this.sun.position.set(40, 70, 20);
    this.scene.add(this.sun);
    this.neonM = new THREE.PointLight(0xff2d95, 0, 160);
    this.neonM.position.set(CITY_SPAN * 0.32, 22, CITY_SPAN * 0.38);
    this.scene.add(this.neonM);
    this.neonC = new THREE.PointLight(0x3df0ff, 0, 160);
    this.neonC.position.set(CITY_SPAN * 0.72, 18, CITY_SPAN * 0.66);
    this.scene.add(this.neonC);
    this.neonA = new THREE.PointLight(0xffb347, 8, 120);
    this.neonA.position.set(CITY_SPAN * 0.5, 16, CITY_SPAN * 0.18);
    this.scene.add(this.neonA);

    this.skyTex = makeSkyTexture(10.4);
    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(1100, 24, 16),
      new THREE.MeshBasicMaterial({
        map: this.skyTex,
        side: THREE.BackSide,
        fog: false,
        depthWrite: false,
      }),
    );
    this.sky.position.set(CITY_SPAN / 2, 0, CITY_SPAN / 2);
    this.scene.add(this.sky);

    // 云层:第二层半球,贴 noise 软白团,缓慢旋转
    this.cloudMat = new THREE.MeshBasicMaterial({
      map: makeCloudTexture(),
      transparent: true,
      opacity: 0.55,
      side: THREE.BackSide,
      fog: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    this.clouds = new THREE.Mesh(new THREE.SphereGeometry(1080, 24, 16), this.cloudMat);
    this.clouds.position.set(CITY_SPAN / 2, 0, CITY_SPAN / 2);
    this.scene.add(this.clouds);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.22, 0.42, 0.62);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.scene.add(this.track.group);
    this.scene.add(this.rider.group);
    this.scene.add(this.particles.group);
    const boot = this.track.planTo({ i: 4, j: 1 }, { i: 4, j: 8 }, null, 0.4);
    this.rider.setRoute(boot);

    this.makeRain();
    this.makeSpeedLines();
    this.bindUi();
    this.refreshTitle();
    this.applyAtmosphere();
    this.resize();
    window.addEventListener("resize", () => this.resize());
    this.camera.position.set(CITY_SPAN / 2, 92, CITY_SPAN / 2 - 80);
    this.camera.lookAt(CITY_SPAN / 2, 0, CITY_SPAN / 2);
    this.renderer.setAnimationLoop(() => this.tick());
  }

  private bindUi() {
    document.getElementById("start-btn")?.addEventListener("click", () => this.start(false));
    document.getElementById("continue-btn")?.addEventListener("click", () => this.start(true));
    document.getElementById("dlg-next")?.addEventListener("click", () => this.nextDialogue());
    document.getElementById("result-ok")?.addEventListener("click", () => {
      this.hud.show("result", false);
      this.resultT = 0;
    });
    document.getElementById("resume-btn")?.addEventListener("click", () => this.setPause(false));
    document.getElementById("mute-btn")?.addEventListener("click", () => this.toggleMute());
    document.getElementById("title-btn")?.addEventListener("click", () => this.backToTitle());
  }

  private refreshTitle() {
    const save = loadSave();
    const cont = document.getElementById("continue-btn");
    if (cont) cont.classList.toggle("hidden", !save);
    if (save) {
      const input = document.getElementById("player-name") as HTMLInputElement | null;
      if (input) input.value = save.name;
    }
  }

  private persist() {
    writeSave(
      snapshot(this.stats, {
        tutorialDone: this.orders.tutorialDone,
        muted: this.audio.muted,
        minutes: this.minutes,
      }),
    );
  }

  private applySave(data: ReturnType<typeof defaultSave>) {
    this.stats.name = data.name;
    this.stats.money = data.money;
    this.stats.goodReviews = data.goodReviews;
    this.stats.deliveries = data.deliveries;
    this.stats.bestCombo = data.bestCombo;
    this.stats.combo = 0;
    this.stats.stamina = 100;
    this.stats.battery = 100;
    this.orders.tutorialDone = data.tutorialDone;
    this.audio.muted = data.muted;
    this.minutes = data.minutes;
  }

  private start(continueGame: boolean) {
    (document.activeElement instanceof HTMLElement ? document.activeElement : null)?.blur();
    document.getElementById("scene")?.focus();
    const name = (document.getElementById("player-name") as HTMLInputElement).value.trim() || "阿龙";
    const save = continueGame ? loadSave() : null;
    if (continueGame && save) this.applySave(save);
    else {
      clearSave();
      this.applySave(defaultSave(name));
      this.orders.tutorialDone = false;
    }

    this.audio.start();
    this.hud.show("title-screen", false);
    this.hud.show("hud", true);
    this.hud.show("phone", true);
    const district = document.getElementById("district-label");
    if (district) district.textContent = `1区 · ${DISTRICT_1.name}`;

    if (continueGame && save?.tutorialDone) {
      this.mode = "playing";
      this.orders.cooldown = 0.2;
      this.hud.toastMsg(`欢迎回来，${this.stats.name}。看手机接单。`);
      return;
    }

    this.dlg = [
      { who: "老马", text: `${this.stats.name}，车自己会拐弯。你左右躲开，空格跳、S 滑铲。` },
      { who: "老马", text: "单在手机上。别抢着跑，先看备注：龙叔那碗粥，放门口，别敲门。" },
    ];
    this.mode = "dialogue";
    this.nextDialogue();
    this.audio.beep(520, 0.1, "sine", 0.04);
  }

  private toggleMute() {
    this.audio.muted = !this.audio.muted;
    this.audio.applyMute();
    const btn = document.getElementById("mute-btn");
    if (btn) btn.textContent = this.audio.muted ? "开启声音" : "静音";
    this.persist();
  }

  private backToTitle() {
    this.persist();
    this.setPause(false);
    this.mode = "title";
    this.hud.show("hud", false);
    this.hud.show("phone", false);
    this.hud.show("dialogue", false);
    this.hud.show("result", false);
    this.hud.show("title-screen", true);
    this.refreshTitle();
  }

  private nextDialogue() {
    const line = this.dlg.shift();
    if (!line) {
      this.hud.show("dialogue", false);
      this.mode = "playing";
      this.orders.cooldown = 0;
      this.audio.orderPing();
      this.hud.toastMsg("手机亮了。接龙叔那单。");
      return;
    }
    this.hud.showDialogue(line.who, line.text);
  }

  private setPause(on: boolean) {
    this.mode = on ? "pause" : "playing";
    this.hud.show("pause", on);
    if (on) this.persist();
  }

  private accept(id: string) {
    const order = this.orders.accept(id);
    if (!order) return;
    this.holding = false;
    const from = this.track.nearestNode(this.rider.x, this.rider.z);
    const difficulty = 1 + this.stats.deliveries * 0.38;
    const dropEst = buildLeg(order.pickup, order.dropoff);
    const rush = order.kind === "urgent" ? 13.6 : 11.2;
    this.audio.orderPing();
    const nearShop =
      Math.abs(from.i - order.pickup.i) + Math.abs(from.j - order.pickup.j) === 0 ||
      Math.hypot(this.rider.x - order.pickup.i * CELL, this.rider.z - order.pickup.j * CELL) < 14;
    if (nearShop) {
      const pickLen = 8;
      order.limitSec = Math.max(22, (pickLen + dropEst.length) / rush + (this.raining ? 8 : 10));
      order.remaining = order.limitSec;
      this.completePickup();
    } else {
      const route = this.track.planTo(
        from,
        order.pickup,
        { kind: "pickup", name: order.restaurantName },
        difficulty,
      );
      order.pickupS = route.pickupS;
      order.dropoffS = dropEst.dropoffS;
      order.limitSec = Math.max(22, (route.length + dropEst.length) / rush + (this.raining ? 8 : 10));
      order.remaining = order.limitSec;
      this.rider.setRoute(route);
      this.hud.toastMsg(`已接单 · 先去 ${order.restaurantName} 取${order.food}`);
    }
    this.persist();
  }

  private completePickup() {
    const order = this.orders.active;
    if (!order || this.holding || order.phase === "toDropoff") return;
    this.holding = true;
    order.phase = "toDropoff";
    this.orders.addChat(order.restaurantName, order.shopLine ?? "餐好了，门口取。");
    if (order.note) this.orders.addChat(order.customerName, order.note);
    this.audio.pickup();
    this.rider.speed *= 0.35;
    const from = this.track.nearestNode(this.rider.x, this.rider.z);
    const difficulty = 1 + this.stats.deliveries * 0.38;
    const route = this.track.planTo(
      from,
      order.dropoff,
      { kind: "dropoff", name: order.customerName },
      difficulty,
    );
    order.dropoffS = route.dropoffS;
    this.rider.setRoute(route);
    this.hud.toastMsg(`已取餐 · 再去送给 ${order.customerName}`);
    this.persist();
  }

  private finishDelivery() {
    const order = this.orders.active;
    if (!order || !this.holding || order.phase !== "toDropoff") return;
    const result = this.orders.settle(this.stats);
    if (!result) return;
    this.holding = false;
    this.audio.success();
    const lines = CUSTOMER_LINES[result.customer];
    const quote = lines ? lines[Math.floor(Math.random() * lines.length)] : null;
    this.hud.showResult(result.stars, result.lines, result.pay, result.customer);
    this.resultT = 2.6;
    this.hud.toastMsg(quote ? `${result.customer}：${quote}` : `${"★".repeat(result.stars)}  +¥${result.pay}`);
    // 送达礼花
    this.particles.coin(this.rider.x, 1.4, this.rider.z);
    this.persist();
  }

  private collide() {
    const route = this.rider.route;
    if (!route) return;
    const s = this.rider.s;
    const lat = this.rider.lateral;
    for (const obs of this.track.obstacles) {
      if (obs.hit || obs.dodged) continue;
      if (Math.abs(s - obs.s) > obs.depth / 2 + 0.9) continue;
      if (Math.abs(lat - obs.lateral) > obs.halfW + 0.75) {
        if (s > obs.s) {
          obs.dodged = true;
          const tight = Math.abs(lat - obs.lateral) < obs.halfW + 1.4;
          this.stats.combo += tight ? 2 : 1;
          this.stats.bestCombo = Math.max(this.stats.bestCombo, this.stats.combo);
          this.audio.combo(this.stats.combo);
          if (tight) {
            this.audio.nearMiss();
            this.hud.toastMsg("好险！");
          }
        }
        continue;
      }
      let pass = false;
      if (obs.kind === "hang") pass = this.rider.sliding;
      else pass = this.rider.y > (obs.kind === "car" ? 1.2 : 0.92);
      if (pass) {
        obs.dodged = true;
        this.stats.combo += 1;
        this.stats.bestCombo = Math.max(this.stats.bestCombo, this.stats.combo);
        this.audio.combo(this.stats.combo);
        continue;
      }
      if (this.rider.invuln > 0) continue;
      obs.hit = true;
      this.rider.crash();
      this.audio.crash();
      this.orders.addBump(1);
      this.stats.combo = 0;
      this.hud.hurt();
      this.hud.toastMsg("撞上了！餐品颠簸");
      // 碰撞火花
      const sm = this.rider.sample();
      const sx = this.rider.x + (sm?.rx ?? 1) * obs.lateral;
      const sz = this.rider.z + (sm?.rz ?? 0) * obs.lateral;
      this.particles.spark(sx, 0.6, sz);
    }

    for (const g of this.track.gates) {
      if (g.used) continue;
      if (s + 1.8 < g.s) continue;
      if (g.kind === "pickup") {
        if (!this.orders.active || this.holding || this.orders.active.phase !== "toPickup") continue;
        g.used = true;
        this.completePickup();
        return;
      }
      if (g.kind === "dropoff") {
        if (!this.holding || this.orders.active?.phase !== "toDropoff") continue;
        g.used = true;
        this.finishDelivery();
        return;
      }
    }

    if (this.holding && this.orders.active?.phase === "toDropoff" && s + 1.2 >= route.dropoffS) {
      this.finishDelivery();
    }
  }

  private makeRain() {
    const n = 900;
    const pos = new Float32Array(n * 6);
    for (let i = 0; i < n; i++) {
      const x = (Math.random() - 0.5) * 42;
      const y = Math.random() * 28;
      const z = (Math.random() - 0.5) * 48;
      pos[i * 6] = x;
      pos[i * 6 + 1] = y;
      pos[i * 6 + 2] = z;
      pos[i * 6 + 3] = x + 0.08;
      pos[i * 6 + 4] = y - 1.4;
      pos[i * 6 + 5] = z + 0.35;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this.rain = new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({
        color: 0xa8d4ff,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
      }),
    );
    this.rain.visible = false;
    this.scene.add(this.rain);
  }

  private makeSpeedLines() {
    const n = 64;
    const pos = new Float32Array(n * 6);
    for (let i = 0; i < n; i++) {
      const x = (Math.random() - 0.5) * 10;
      const y = 0.4 + Math.random() * 4.2;
      const z = (Math.random() - 0.4) * 16;
      pos[i * 6] = x;
      pos[i * 6 + 1] = y;
      pos[i * 6 + 2] = z;
      pos[i * 6 + 3] = x;
      pos[i * 6 + 4] = y;
      pos[i * 6 + 5] = z - 1.8;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this.speedLines = new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({
        color: 0xc8e8ff,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
      }),
    );
    this.speedLines.visible = false;
    this.scene.add(this.speedLines);
  }

  private tickRain(dt: number) {
    if (!this.rain || !this.raining) return;
    const attr = this.rain.geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < attr.count; i += 2) {
      let y = attr.getY(i) - dt * 32;
      if (y < 0) y += 28;
      attr.setY(i, y);
      attr.setY(i + 1, y - 1.4);
    }
    attr.needsUpdate = true;
    this.rain.position.set(this.rider.x, 0, this.rider.z);
  }

  private tickSpeedLines() {
    if (!this.speedLines) return;
    const fast = this.mode === "playing" && this.rider.speed > 16.5;
    this.speedLines.visible = fast;
    if (!fast) return;
    this.speedLines.position.copy(this.rider.group.position);
    this.speedLines.rotation.y = this.rider.yaw;
    const mat = this.speedLines.material as THREE.LineBasicMaterial;
    mat.opacity = Math.min(0.35, (this.rider.speed - 16) * 0.05);
  }

  private tick() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.minutes += dt * 8;
    this.rainClock -= dt;
    if (this.rainClock <= 0) {
      this.raining = !this.raining;
      this.rainClock = 55 + Math.random() * 50;
    }
    if (this.rain) this.rain.visible = this.raining;
    if (this.raining !== this.rainKnown) {
      this.rainKnown = this.raining;
      this.audio.setRain(this.raining);
      if (this.mode === "playing") this.hud.toastMsg(this.raining ? "下雨了，路滑减速" : "雨停了");
    }
    this.applyAtmosphere();
    this.track.setWet(this.raining ? 1 : 0);
    this.tickRain(dt);
    this.track.update(dt);
    this.tickSpeedLines();
    this.particles.update(dt);

    if (this.resultT > 0) {
      this.resultT -= dt;
      if (this.resultT <= 0) this.hud.show("result", false);
    }

    if (this.mode === "playing") {
      if (this.input.consume("Escape")) this.setPause(true);
      if (this.input.consume("KeyC")) this.rider.firstPerson = !this.rider.firstPerson;
      if (this.input.consume("Digit1") && this.orders.offers[0]) this.accept(this.orders.offers[0].id);
      if (this.input.consume("Digit2") && this.orders.offers[1]) this.accept(this.orders.offers[1].id);
      if (this.input.consume("Digit3") && this.orders.offers[2]) this.accept(this.orders.offers[2].id);

      const idle = !this.orders.active;
      const heavy = Boolean(this.holding && this.orders.active?.kind === "heavy");
      this.rider.update(dt, this.input, this.stats, heavy, this.raining, idle);
      this.track.updateRibbon(this.rider.s);
      // 落地尘土 + 漂移烟
      if (this.rider.consumeLanding()) {
        this.particles.dust(this.rider.x, 0.1, this.rider.z);
      }
      if (this.rider.speed > 18 && Math.abs(this.input.axis().x) > 0.6 && !this.rider.jumping) {
        if (Math.random() < 0.4) this.particles.smoke(this.rider.x, 0.2, this.rider.z);
      }
      if (!idle) {
        this.tickOrderBeats();
        this.collide();
      }
      const pulse = this.orders.update(dt, this.stats);
      if (pulse === "new") {
        this.audio.orderPing();
        this.hud.toastMsg(this.orders.offers.length > 1 ? `${this.orders.offers.length} 个新订单，选一单` : "新订单来了，按 1 接单");
      }
      if (pulse === "expired") this.hud.toastMsg("单被人抢走了");
      if (this.orders.active && this.orders.active.remaining < 0 && this.orders.active.remaining > -dt) {
        this.hud.toastMsg(this.holding ? "已超时，沿导航尽快送达" : "已超时，先去店里取餐");
      }
    } else if (this.mode === "pause") {
      if (this.input.consume("Escape")) this.setPause(false);
    } else if (this.mode === "dialogue") {
      if (this.input.consume("KeyE") || this.input.consume("Space") || this.input.consume("Enter")) this.nextDialogue();
    }

    if (this.mode === "title") {
      const t = this.clock.elapsedTime * 0.08;
      this.camera.position.set(CITY_SPAN / 2 + Math.cos(t) * 210, 36, CITY_SPAN / 2 + Math.sin(t) * 210);
      this.camera.lookAt(CITY_SPAN / 2, 8, CITY_SPAN / 2);
      this.camera.fov = 56;
      this.camera.updateProjectionMatrix();
    } else {
      this.rider.followCamera(this.camera, dt);
      this.sky.position.x = this.camera.position.x;
      this.sky.position.z = this.camera.position.z;
      this.clouds.position.x = this.camera.position.x;
      this.clouds.position.z = this.camera.position.z;
      this.clouds.rotation.y += dt * 0.008;
    }
    this.audio.engine(this.mode === "playing" ? this.rider.speed : 0);
    this.hud.setClock(this.minutes, this.raining);
    this.hud.stats(this.stats, this.rider.speed, this.orders);
    this.hud.meters(this.orders.active, this.holding);
    this.hud.phone(this.orders.offers, this.orders.active, this.holding, (id) => this.accept(id));
    this.hud.nav(this.rider, this.holding, !this.orders.active);
    const gate = this.track.nextGate();
    const obs = this.track.aheadObstacle(this.rider.s);
    let prompt: string | null = null;
    if (this.mode === "playing" && !this.orders.active) {
      prompt = this.orders.offers.length ? "看手机接单 · 按 1 / 2 / 3" : "听单中…";
    } else if (this.mode === "playing" && gate && gate.s - this.rider.s < 18) {
      prompt = gate.kind === "pickup" ? "前方取餐" : "前方送达";
    } else if (this.mode === "playing" && obs) {
      prompt =
        obs.kind === "hang"
          ? "前方横杆 · S 滑铲"
          : obs.kind === "car"
            ? "前方车辆 · 左右躲 或 空格跳"
            : obs.kind === "cone"
              ? "前方路锥 · 左右躲开"
              : "前方路障 · 空格跳 或 左右躲";
    }
    this.hud.setPrompt(prompt);
    this.hud.drawGps(this.track, this.rider, this.holding);
    this.composer.render();
  }

  private tickOrderBeats() {
    const order = this.orders.active;
    const route = this.rider.route;
    if (!order || !route) return;
    const destS = this.holding ? route.dropoffS : route.pickupS;
    const left = destS - this.rider.s;
    if (!this.holding && left < 22 && !order.pingedShop) {
      order.pingedShop = true;
      this.orders.addChat(order.restaurantName, order.shopLine ?? "好了，门口取。");
      this.hud.toastMsg(`${order.restaurantName}：餐好了`);
      this.audio.beep(720, 0.08, "sine", 0.04);
    }
    if (this.holding && left < 28 && !order.pingedNear) {
      order.pingedNear = true;
      const waits = CUSTOMER_WAIT[order.customerName];
      const line = waits ? waits[Math.floor(Math.random() * waits.length)]! : "我到门口了。";
      this.orders.addChat(order.customerName, line);
      this.hud.toastMsg(`${order.customerName}：${line}`);
      this.audio.beep(880, 0.07, "sine", 0.035);
    }
    if (this.holding && order.remaining < 9 && !order.pingedLate) {
      order.pingedLate = true;
      this.orders.addChat(order.customerName, "还要多久？");
      this.hud.toastMsg(`${order.customerName}：还要多久？`);
    }
  }

  private applyAtmosphere() {
    const hour = (this.minutes / 60) % 24;
    const night = nightFactor(hour);
    const dusk = duskFactor(hour);
    const day = 1 - night;
    const name = periodName(hour);
    const rain = this.raining ? 1 : 0;

    this.hemi.color.setRGB(1 - night * 0.55, 0.9 - night * 0.4, 0.75 - night * 0.2);
    this.hemi.groundColor.setRGB(0.35 - night * 0.2, 0.42 - night * 0.28, 0.22 + night * 0.05);
    this.hemi.intensity = 0.55 + day * 0.55;
    this.sun.color.setRGB(1, 0.93 - dusk * 0.2, 0.78 + day * 0.1 - night * 0.15);
    this.sun.intensity = 0.18 + day * 1.22 + dusk * 0.25;
    this.sun.position.set(CITY_SPAN * 0.35, 16 + day * 72, CITY_SPAN * 0.18);
    this.neonM.intensity = 18 * night;
    this.neonC.intensity = 16 * night;
    this.neonA.intensity = 4 + night * 8;

    const fog = new THREE.Color().setRGB(
      0.72 * day + 0.9 * dusk * 0.35 + 0.05 * night,
      0.8 * day + 0.55 * dusk + 0.05 * night,
      0.88 * day + 0.28 * dusk + 0.09 * night,
    );
    if (rain) fog.lerp(new THREE.Color(0x6a7380), 0.35);
    this.fog.color.copy(fog);
    this.fog.density = 0.0026 + night * 0.0032 + dusk * 0.0016 + rain * 0.0024;
    this.scene.background = fog.clone();
    this.bloom.strength = (0.16 + night * 0.42) * (rain ? 0.78 : 1);
    this.renderer.toneMappingExposure = 1.18 - night * 0.14;

    this.track.setPeriod(night);

    if (Math.abs(hour - this.lastSkyH) > 0.04 || this.raining !== this.lastSkyRain) {
      paintSky(this.skyTex, hour, this.raining);
      this.lastSkyH = hour;
      this.lastSkyRain = this.raining;
    }
    // 云层:白天显眼,夜晚淡化,雨天加浓
    const cloudOpacity = (0.55 * day + 0.08 * night) * (this.raining ? 1.4 : 1);
    this.cloudMat.opacity = Math.min(0.7, cloudOpacity);

    if (name !== this.lastPeriod) {
      if (this.lastPeriod && this.mode === "playing") {
        if (name === "清晨") this.hud.toastMsg("天亮了");
        else if (name === "黄昏") this.hud.toastMsg("黄昏到了");
        else if (name === "夜晚") this.hud.toastMsg("入夜了，霓虹亮起来");
      }
      this.lastPeriod = name;
    }
  }

  private resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
  }
}
