import { Game } from "./game/Game";

const canvas = document.getElementById("scene");
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("缺少画布");
}

new Game(canvas);
