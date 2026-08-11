/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from "vitest";
import { getString, setString, getJSON, setJSON, removeKey } from "./storage";

describe("storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns fallback when key is absent", () => {
    expect(getString("missing", "fallback")).toBe("fallback");
    expect(getJSON("missing", { a: 1 })).toEqual({ a: 1 });
  });

  it("round-trips strings", () => {
    setString("k", "v");
    expect(getString("k")).toBe("v");
  });

  it("round-trips JSON", () => {
    setJSON("obj", { a: 1, b: [1, 2, 3] });
    expect(getJSON("obj", null)).toEqual({ a: 1, b: [1, 2, 3] });
  });

  it("falls back on malformed JSON", () => {
    setString("bad", "{not json");
    expect(getJSON("bad", "fallback")).toBe("fallback");
  });

  it("removeKey clears a key", () => {
    setString("k", "v");
    removeKey("k");
    expect(getString("k")).toBeNull();
  });
});
