import "./styles/main.css";
import { createApp } from "vue";
import { RouterView } from "vue-router";
import { createStudioRouter } from "./router";

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) {
  throw new Error("#app not found");
}

createApp(RouterView).use(createStudioRouter()).mount(root);
