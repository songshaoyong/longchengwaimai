export class Input {
  readonly keys = new Set<string>();
  private taps = new Set<string>();
  mouseDx = 0;
  mouseDown = false;

  constructor() {
    window.addEventListener("keydown", (e) => {
      this.keys.add(e.code);
      this.taps.add(e.code);
      if (["KeyW", "KeyA", "KeyS", "KeyD", "Space", "ControlLeft"].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    window.addEventListener("blur", () => {
      this.keys.clear();
      this.taps.clear();
    });
    window.addEventListener("mousedown", () => {
      this.mouseDown = true;
    });
    window.addEventListener("mouseup", () => {
      this.mouseDown = false;
    });
    window.addEventListener("mousemove", (e) => {
      if (this.mouseDown) this.mouseDx += e.movementX;
    });
  }

  down(code: string) {
    return this.keys.has(code);
  }

  consume(code: string) {
    if (this.taps.has(code) || this.keys.has(code)) {
      this.taps.delete(code);
      this.keys.delete(code);
      return true;
    }
    return false;
  }

  axis() {
    let x = 0;
    let z = 0;
    if (this.down("KeyA") || this.down("ArrowLeft")) x -= 1;
    if (this.down("KeyD") || this.down("ArrowRight")) x += 1;
    if (this.down("KeyW") || this.down("ArrowUp")) z += 1;
    if (this.down("KeyS") || this.down("ArrowDown")) z -= 1;
    return { x, z };
  }

  flushMouse() {
    const dx = this.mouseDx;
    this.mouseDx = 0;
    return dx;
  }
}
