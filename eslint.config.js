// @ts-check
import tseslint from "typescript-eslint";

// Type-aware linting (recommendedTypeChecked, not just the syntax-only
// "recommended" set) - catches classes of bug tsc's own noEmit typecheck
// doesn't, most importantly floating promises (an async call started but
// never awaited/handled - this codebase has several `void someAsyncCall()`
// call sites specifically to mark that as deliberate, which this rule set
// is what makes that pattern meaningful rather than just stylistic).
//
// Explicit `project` array (not `projectService: true`'s auto-discovery) -
// this repo has two tsconfigs (tsconfig.json for everything except
// src/sw.ts, tsconfig.sw.json for src/sw.ts alone - see that file's own
// header comment for why a service worker needs a separate program), and
// projectService's auto-walk only looks for files literally named
// tsconfig.json, so it never finds the second, non-standard-named one.
export default tseslint.config(
  {
    // eslint.config.js itself isn't covered by either tsconfig's include
    // patterns (it's root-level tooling config, not app source under
    // src/) - excluded from type-aware linting rather than adding a third
    // tsconfig just to cover one file.
    ignores: ["dist/**", "node_modules/**", "sw.js", "eslint.config.js"],
  },
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.json", "./tsconfig.sw.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // This codebase uses `void somePromise()` at several call sites
      // specifically to mark "started, deliberately not awaited" as
      // intentional (e.g. main.ts's button handlers) - the rule itself is
      // exactly what makes that marker meaningful, not something to
      // silence with a blanket "ignoreVoid".
      "@typescript-eslint/no-floating-promises": "error",
    },
  },
  {
    // Test files pass mocked methods (navigator.clipboard.writeText,
    // document.execCommand, a saved-off Range.prototype.getBoundingClientRect)
    // straight into expect(...)/vi.fn() assertions or a save-and-restore
    // variable - inspected or reassigned, never called detached from their
    // object, so the rule's actual "this` gets lost" risk doesn't apply.
    // Scoped to test files only - app code still gets the real check.
    files: ["**/*.test.ts"],
    rules: {
      "@typescript-eslint/unbound-method": "off",
    },
  },
);
