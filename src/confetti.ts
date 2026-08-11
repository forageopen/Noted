/**
 * src/confetti.ts
 *
 * Logo click easter egg: clicking (or press-and-holding) the "Noted"
 * wordmark fires a full-viewport confetti shower - pieces fall from above
 * the viewport to below it, fading out, over ~5s. Each press/repeat is a
 * single solid color, cycling through a fixed palette. Purely decorative -
 * respects prefers-reduced-motion (styles.css) by disabling the fall
 * animation entirely rather than just slowing it down.
 */

const PALETTE = [
  "#ff5c5c",
  "#ff9f40",
  "#ffd43b",
  "#69db7c",
  "#38d9a9",
  "#4dabf7",
  "#748ffc",
  "#9775fa",
  "#f783ac",
  "#ff8787",
];

const PIECES_PER_BURST = 140;
const MIN_FALL_S = 3.2;
const MAX_FALL_S = 5.2;
const MAX_DELAY_S = 0.4;
/** How long a burst's DOM stays around before being removed - covers the
 * slowest piece's delay + fall duration plus a small safety margin. */
const BURST_LIFETIME_MS = Math.round((MAX_FALL_S + MAX_DELAY_S + 0.3) * 1000);
/** How often a new burst fires while the logo is held down. */
const HOLD_INTERVAL_MS = 220;

/** Pure: the color for the Nth burst (0-based), cycling through the fixed
 * palette - exported so the cycling logic is testable without any DOM. */
export function confettiColorForIndex(index: number): string {
  return PALETTE[((index % PALETTE.length) + PALETTE.length) % PALETTE.length] ?? PALETTE[0]!;
}

export interface ConfettiPieceSpec {
  leftPercent: number;
  widthPx: number;
  heightPx: number;
  fallSeconds: number;
  delaySeconds: number;
  rotateDeg: number;
  driftPx: number;
  brightness: number;
}

/** Pure: randomize one piece's fall parameters. Takes a `random` function
 * (defaults to Math.random) purely so tests can supply a deterministic one
 * instead of asserting on literally-random output. */
export function randomConfettiPiece(random: () => number = Math.random): ConfettiPieceSpec {
  return {
    leftPercent: random() * 100,
    widthPx: 6 + random() * 6,
    heightPx: 3 + random() * 3,
    fallSeconds: MIN_FALL_S + random() * (MAX_FALL_S - MIN_FALL_S),
    delaySeconds: random() * MAX_DELAY_S,
    rotateDeg: (random() < 0.5 ? -1 : 1) * (360 + random() * 360),
    driftPx: (random() - 0.5) * 120,
    brightness: 0.85 + random() * 0.3,
  };
}

/** DOM: build one confetti piece element from a spec + color. */
export function createConfettiPieceEl(spec: ConfettiPieceSpec, color: string): HTMLElement {
  const piece = document.createElement("span");
  piece.className = "confetti-piece";
  piece.style.left = `${spec.leftPercent}%`;
  piece.style.width = `${spec.widthPx}px`;
  piece.style.height = `${spec.heightPx}px`;
  piece.style.background = color;
  piece.style.filter = `brightness(${spec.brightness})`;
  piece.style.animationDuration = `${spec.fallSeconds}s`;
  piece.style.animationDelay = `${spec.delaySeconds}s`;
  piece.style.setProperty("--confetti-rotate", `${spec.rotateDeg}deg`);
  piece.style.setProperty("--confetti-drift", `${spec.driftPx}px`);
  return piece;
}

/** DOM: fire one burst of `PIECES_PER_BURST` pieces in `color`, appended
 * to `overlay`, auto-removed after they've all finished falling. */
export function launchConfettiBurst(overlay: HTMLElement, color: string): void {
  const burst = document.createElement("div");
  burst.className = "confetti-burst";
  for (let i = 0; i < PIECES_PER_BURST; i++) {
    burst.appendChild(createConfettiPieceEl(randomConfettiPiece(), color));
  }
  overlay.appendChild(burst);
  window.setTimeout(() => burst.remove(), BURST_LIFETIME_MS);
}

/** Wires a click-and-hold confetti trigger onto `logo`. A tap fires one
 * burst; holding fires repeated bursts (one every HOLD_INTERVAL_MS) until
 * release. Each burst cycles to the next palette color. Creates a single
 * full-viewport overlay (appended to document.body once) that every burst
 * renders into. */
export function setupConfettiTrigger(logo: HTMLElement): void {
  const overlay = document.createElement("div");
  overlay.className = "confetti-overlay";
  document.body.appendChild(overlay);

  let burstIndex = 0;
  let holdTimer: number | null = null;

  const fire = (): void => {
    launchConfettiBurst(overlay, confettiColorForIndex(burstIndex));
    burstIndex++;
  };

  logo.style.cursor = "pointer";
  logo.addEventListener("mousedown", () => {
    fire();
    holdTimer = window.setInterval(fire, HOLD_INTERVAL_MS);
  });

  const stopHold = (): void => {
    if (holdTimer !== null) {
      window.clearInterval(holdTimer);
      holdTimer = null;
    }
  };
  logo.addEventListener("mouseup", stopHold);
  logo.addEventListener("mouseleave", stopHold);
}
