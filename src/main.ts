/**
 * src/main.ts
 *
 * Entry point: wires the global theme toggle and the dual-window toggle,
 * and instantiates one or two `Pane`s.
 */

import { Pane } from "./pane";
import { setupThemeToggle, type Theme } from "./theme";
import { getJSON, setJSON } from "./storage";

const DUAL_KEY = "noted:dual-pane";

function main(): void {
  const themeButton = document.getElementById("theme-toggle") as HTMLButtonElement | null;
  const dualButton = document.getElementById("dual-toggle") as HTMLButtonElement | null;
  const panesContainer = document.getElementById("panes");

  if (!themeButton || !dualButton || !panesContainer) {
    throw new Error("main: expected #theme-toggle, #dual-toggle, and #panes in index.html");
  }

  let currentTheme: Theme = setupThemeToggle(themeButton);
  themeButton.addEventListener("click", () => {
    // setupThemeToggle already flipped + persisted + applied; we just need
    // the current value for exports (Pane reads it lazily via getTheme).
    currentTheme = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  });

  let panes: Pane[] = [];

  function mountPanes(dual: boolean): void {
    for (const pane of panes) pane.destroy();
    panesContainer!.innerHTML = "";
    panesContainer!.classList.toggle("panes-dual", dual);
    panesContainer!.classList.toggle("panes-single", !dual);
    panes = [new Pane(panesContainer!, () => currentTheme)];
    if (dual) panes.push(new Pane(panesContainer!, () => currentTheme));
  }

  let dual = getJSON<boolean>(DUAL_KEY, false);
  mountPanes(dual);
  updateDualButton();

  dualButton.addEventListener("click", () => {
    dual = !dual;
    setJSON(DUAL_KEY, dual);
    mountPanes(dual);
    updateDualButton();
  });

  function updateDualButton(): void {
    dualButton!.textContent = dual ? "Single window" : "Dual window";
    dualButton!.setAttribute("aria-pressed", String(dual));
  }
}

main();
