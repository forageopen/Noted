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

  // Toggling dual mode must never touch a pane that already has content -
  // it previously destroyed and recreated ALL panes on every toggle,
  // silently dropping whatever was loaded in the first pane. Now it only
  // adds or removes the second pane; the first pane (and its content) is
  // never destroyed just because dual mode was flipped.
  function mountPanes(dual: boolean): void {
    panesContainer!.classList.toggle("panes-dual", dual);
    panesContainer!.classList.toggle("panes-single", !dual);

    if (panes.length === 0) {
      panes.push(new Pane(panesContainer!, () => currentTheme));
    }
    if (dual && panes.length === 1) {
      panes.push(new Pane(panesContainer!, () => currentTheme));
    } else if (!dual && panes.length === 2) {
      panes.pop()!.destroy();
    }
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
