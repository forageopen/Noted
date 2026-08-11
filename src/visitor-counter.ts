/**
 * src/visitor-counter.ts
 *
 * Two footer badges - "visitors this week" and "total visitors" - backed by
 * visitor-badge.laobi.icu, a free, no-signup, actively-maintained hit
 * counter: loading its badge <img> increments (and returns, baked into the
 * SVG) a counter keyed by the `page_id` query param. No backend of our own,
 * no polling API call from this app's code - just an <img src>, same as any
 * other embedded image. This IS real, non-simulated traffic (each page load
 * = one hit to each badge below) - there's no dedup by visitor, so it
 * counts page loads, not unique people, same as most badge counters of
 * this kind.
 *
 * (An earlier version of this used hits.seeyoufarm.com, which turned out to
 * be dead - the domain no longer resolves at all, confirmed via DNS, not
 * just unreachable from one network. Verified this one actually works,
 * live, before wiring it up - see the increment-across-repeated-requests
 * check that motivated the switch.)
 *
 * The "this week" badge resets itself every Monday with no logic of ours to
 * maintain: its key includes the ISO-8601 week string (`isoWeekKey`, weeks
 * run Monday-Sunday), so the first hit of a new week is a key the service
 * has never seen before and starts back at zero. The "total" badge uses a
 * fixed key, so it never resets.
 *
 * Note this embeds a third-party tracking pixel, which sends the visitor's
 * IP/user-agent to visitor-badge.laobi.icu on every page load - a real, if
 * minor, exception to this app's "nothing leaves your machine" posture
 * (README). Flagging that plainly rather than letting the claim quietly go
 * stale.
 */

const SITE_ID = "forageopen.noted";

/** Pure: this Monday-Sunday ISO-8601 week, as e.g. "2026-W33". Computed in
 * UTC so it doesn't depend on the visitor's local timezone/DST. */
export function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = (d.getUTCDay() + 6) % 7; // Monday=0 .. Sunday=6
  d.setUTCDate(d.getUTCDate() - dayNum + 3); // shift to this week's Thursday
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Pure: build a visitor-badge.laobi.icu badge URL for a given counter key. */
export function badgeUrl(pageId: string, leftText: string): string {
  const params = new URLSearchParams({
    page_id: pageId,
    left_text: leftText,
    left_color: "#555555",
    right_color: "#ff2ea6",
  });
  return `https://visitor-badge.laobi.icu/badge?${params.toString()}`;
}

export interface VisitorCounterElements {
  weekImg: HTMLImageElement;
  totalImg: HTMLImageElement;
}

/** DOM: point the two badge <img>s at this week's and the all-time counter. */
export function setupVisitorCounter(elements: VisitorCounterElements, now: Date = new Date()): void {
  elements.weekImg.src = badgeUrl(`${SITE_ID}.week.${isoWeekKey(now)}`, "this week");
  elements.totalImg.src = badgeUrl(`${SITE_ID}.total`, "total visitors");
}
