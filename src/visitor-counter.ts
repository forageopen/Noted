/**
 * src/visitor-counter.ts
 *
 * Footer visitor counter, backed by GoatCounter (goatcounter.com) - a
 * privacy-focused, cookie-free analytics service that dedupes hits by
 * hashed IP+user-agent+day server-side, so a visitor refreshing the page
 * (or the same person returning the same day) is counted once, not once
 * per page load.
 *
 * This replaces an earlier visitor-badge.laobi.icu-based counter
 * (ADR-004): that service counted every single page load with no dedup
 * at all, so refreshing inflated the number - not what "visitor counter"
 * should mean. See ADR-006 (`PRODUCT-DECISIONS.md`) for the switch and
 * its reasoning, including why the footer links to GoatCounter's public
 * dashboard rather than showing a live inline number - reading a live
 * count back into the page would need GoatCounter's API, which requires a
 * Bearer token; embedding that token in client-side code would let anyone
 * view-source the page and steal it, and the API isn't CORS-enabled for
 * browser use in the first place. The "Visitor stats" link itself
 * (index.html) is a plain, static, always-present `<a>`, same as the
 * Credits/Forage links next to it - no JS needed to wire it.
 *
 * Note this still embeds a third-party tracking script, which sends the
 * visitor's IP/user-agent to GoatCounter on every page load - a real, if
 * minor, exception to this app's "nothing leaves your machine" posture
 * (README), same disclosed tradeoff as ADR-004, now with actual dedup
 * instead of none.
 */

const GOATCOUNTER_SITE = "https://forage.goatcounter.com";
const GOATCOUNTER_SCRIPT_SRC = "//gc.zgo.at/count.js";

/** The one hostname real visits arrive on. Guarding on this keeps local
 * dev/preview/E2E-test page loads from pinging GoatCounter and inflating
 * the real count - same reasoning ADR-004 already established for the
 * counter this replaces. */
const PRODUCTION_HOSTNAME = "forageopen.github.io";

/** DOM: injects GoatCounter's tracking script - only on the real
 * production host (see PRODUCTION_HOSTNAME above), and only once (a
 * repeat call, e.g. from a test, is a no-op if the script is already
 * present rather than double-counting a single page load). */
export function setupVisitorTracking(hostname: string = window.location.hostname, doc: Document = document): void {
  if (hostname !== PRODUCTION_HOSTNAME) return;
  if (doc.querySelector(`script[src="${GOATCOUNTER_SCRIPT_SRC}"]`)) return;

  const script = doc.createElement("script");
  script.async = true;
  script.src = GOATCOUNTER_SCRIPT_SRC;
  script.dataset.goatcounter = `${GOATCOUNTER_SITE}/count`;
  doc.head.appendChild(script);
}
