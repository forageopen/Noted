/**
 * src/main.ts
 *
 * Entry point: wires the global theme toggle and the dual-window toggle,
 * and instantiates one or two `Pane`s.
 */

import { Pane } from "./pane";
import { setupThemeToggle, type Theme } from "./theme";
import { setupOfflineToggle, setupOfflineUpdates } from "./offline";
import { setupConfettiTrigger } from "./confetti";
import { setupVisitorCounter } from "./visitor-counter";
import { setupFooterAutoHide } from "./footer";
import { getJSON, setJSON } from "./storage";
import { dualPaneIcon, singlePaneIcon } from "./icons";

function readCurrentTheme(): Theme {
  return document.documentElement.getAttribute("data-theme") === "cherry" ? "cherry" : "sakura";
}

const DUAL_KEY = "noted:dual-pane";

function main(): void {
  const themeButton = document.getElementById("theme-toggle") as HTMLButtonElement | null;
  const dualButton = document.getElementById("dual-toggle") as HTMLButtonElement | null;
  const offlineButton = document.getElementById("offline-toggle") as HTMLButtonElement | null;
  const logo = document.getElementById("app-logo");
  const panesContainer = document.getElementById("panes");

  if (!themeButton || !dualButton || !offlineButton || !logo || !panesContainer) {
    throw new Error("main: expected #theme-toggle, #dual-toggle, #offline-toggle, #app-logo, and #panes in index.html");
  }

  setupOfflineToggle(offlineButton);
  setupOfflineUpdates();
  setupConfettiTrigger(logo);

  const weekBadge = document.getElementById("visitor-week-badge") as HTMLImageElement | null;
  const totalBadge = document.getElementById("visitor-total-badge") as HTMLImageElement | null;
  if (weekBadge && totalBadge) {
    setupVisitorCounter({ weekImg: weekBadge, totalImg: totalBadge });
  }

  const footer = document.querySelector<HTMLElement>(".app-footer");
  if (footer) setupFooterAutoHide(footer);

  let currentTheme: Theme = setupThemeToggle(themeButton);
  themeButton.addEventListener("click", () => {
    // setupThemeToggle already flipped + persisted + applied; we just need
    // the current value for exports (Pane reads it lazily via getTheme).
    currentTheme = readCurrentTheme();
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
    // Icon and title/aria-label both describe the mode a click switches TO
    // (matches theme.ts's fix - showing the CURRENT layout's icon next to
    // the NEXT layout's label was the bug, they visibly disagreed).
    const next = dual ? "Single window" : "Dual window";
    dualButton!.innerHTML = dual ? singlePaneIcon : dualPaneIcon;
    dualButton!.title = next;
    dualButton!.setAttribute("aria-label", `${next} - currently ${dual ? "dual" : "single"} window`);
    dualButton!.setAttribute("aria-pressed", String(dual));
  }
}

main();
