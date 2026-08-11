/**
 * src/export/json.ts
 *
 * .json export: serializes the shared document IR (src/document-model.ts)
 * as pretty-printed JSON. Uses the exact same IR the .docx exporter
 * consumes (see src/pane.ts's `buildDocument`), so .json export is a
 * lossless dump of "what Noted parsed the document as" - useful for
 * round-tripping/inspecting/feeding into other tools, not a rendering
 * format the way .html/.pdf are.
 */

import type { Block } from "../document-model";
import { downloadBlob, withExtension } from "./html";

export interface NotedJsonDocument {
  version: 1;
  blocks: Block[];
}

/** Pure: serialize IR blocks into a pretty-printed JSON string. */
export function blocksToJson(blocks: Block[]): string {
  const doc: NotedJsonDocument = { version: 1, blocks };
  return JSON.stringify(doc, null, 2);
}

/** DOM: build + download the .json export. */
export function exportJson(title: string, blocks: Block[]): void {
  const json = blocksToJson(blocks);
  downloadBlob(withExtension(title, "json"), json, "application/json");
}
