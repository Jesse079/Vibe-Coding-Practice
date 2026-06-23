import "./styles.css";
import { AirDrawingApp } from "./app/air-drawing-app";

const appElement = document.querySelector<HTMLElement>("#app");

if (!appElement) {
  throw new Error("应用挂载节点不存在。");
}

new AirDrawingApp(appElement);
