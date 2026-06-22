import "./styles.css";

const appElement = document.querySelector<HTMLDivElement>("#app");

if (!appElement) {
  throw new Error("应用挂载节点不存在。");
}

appElement.innerHTML = `
  <main class="app-shell" aria-labelledby="app-title">
    <header class="status-pill" aria-label="应用状态">
      <span class="status-pill__dot" aria-hidden="true"></span>
      <span>工程骨架已就绪</span>
    </header>

    <section class="welcome-panel">
      <p class="welcome-panel__eyebrow">AIR DRAWING CANVAS</p>
      <h1 id="app-title">隔空手写画板</h1>
      <p>
        视觉方向已确认。下一阶段将接入摄像头和统一坐标层，
        当前页面不会请求任何设备权限。
      </p>
    </section>

    <footer class="stage-dock" aria-label="当前开发阶段">
      <span class="stage-dock__label">当前里程碑</span>
      <strong>M3 · 工程骨架</strong>
      <span class="stage-dock__divider" aria-hidden="true"></span>
      <span>Vite + TypeScript</span>
    </footer>
  </main>
`;
