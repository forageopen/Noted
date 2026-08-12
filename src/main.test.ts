/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest";

function makeFile(name: string, content: string): File {
  return new File([content], name, { type: "text/markdown" });
}

async function loadFile(pane: Element, name: string, content: string): Promise<void> {
  const fileInput = pane.querySelector<HTMLInputElement>(".file-input")!;
  const file = makeFile(name, content);
  Object.defineProperty(fileInput, "files", { value: [file], configurable: true });
  fileInput.dispatchEvent(new Event("change"));
  await vi.waitFor(() => {
    expect(pane.querySelector(".content")!.hasAttribute("hidden")).toBe(false);
  });
}

/** main.ts runs `main()` immediately at import time and wires up
 * #theme-toggle/#dual-toggle/#panes by id - set up that DOM, then a fresh
 * dynamic import (with vi.resetModules() first) gives a fresh, independent
 * `main()` invocation per test. */
async function bootMain(): Promise<{ dualButton: HTMLButtonElement; panesContainer: HTMLElement }> {
  document.body.innerHTML = `
    <button id="theme-toggle"></button>
    <div id="theme-popover"></div>
    <button id="dual-toggle"></button>
    <button id="offline-toggle"></button>
    <h1 id="app-logo">Noted</h1>
    <main id="panes"></main>
  `;
  vi.resetModules();
  await import("./main");
  return {
    dualButton: document.getElementById("dual-toggle") as HTMLButtonElement,
    panesContainer: document.getElementById("panes") as HTMLElement,
  };
}

beforeEach(() => {
  localStorage.clear();
  document.execCommand = vi.fn().mockReturnValue(true) as unknown as typeof document.execCommand;
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
});

describe("main.ts dual-pane toggle", () => {
  it("switching single -> dual keeps the first pane's already-loaded content", async () => {
    const { dualButton, panesContainer } = await bootMain();
    const firstPane = panesContainer.children[0]!;
    await loadFile(firstPane, "a.md", "# Hello\n\nWorld");
    expect(firstPane.querySelector(".content")!.innerHTML).toContain("Hello");

    dualButton.click(); // -> dual

    expect(panesContainer.children.length).toBe(2);
    // Same pane element, not a freshly (re)created empty one.
    expect(panesContainer.children[0]).toBe(firstPane);
    expect(firstPane.querySelector(".content")!.innerHTML).toContain("Hello");
  });

  it("switching dual -> single keeps the first pane's content and drops only the second", async () => {
    const { dualButton, panesContainer } = await bootMain();
    dualButton.click(); // -> dual
    const firstPane = panesContainer.children[0]!;
    const secondPane = panesContainer.children[1]!;
    await loadFile(firstPane, "a.md", "# First");
    await loadFile(secondPane, "b.md", "# Second");

    dualButton.click(); // -> single

    expect(panesContainer.children.length).toBe(1);
    expect(panesContainer.children[0]).toBe(firstPane);
    expect(firstPane.querySelector(".content")!.innerHTML).toContain("First");
  });

  it("round-tripping single -> dual -> single -> dual still preserves the first pane's content", async () => {
    const { dualButton, panesContainer } = await bootMain();
    const firstPane = panesContainer.children[0]!;
    await loadFile(firstPane, "a.md", "# Persistent");

    dualButton.click(); // dual
    dualButton.click(); // single
    dualButton.click(); // dual again

    expect(panesContainer.children[0]).toBe(firstPane);
    expect(firstPane.querySelector(".content")!.innerHTML).toContain("Persistent");
  });
});
