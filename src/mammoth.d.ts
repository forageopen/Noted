/**
 * src/mammoth.d.ts
 *
 * mammoth ships no TypeScript types, and its browser entry point
 * (`mammoth/mammoth.browser`, needed so esbuild's default browser platform
 * pulls in mammoth's browser/ zip + file shims instead of Node's `fs`) isn't
 * covered by @types/mammoth even if that existed. Minimal ambient shape for
 * the one function this codebase calls (see src/file-loader.ts).
 */
declare module "mammoth/mammoth.browser" {
  export interface ConvertToHtmlResult {
    value: string;
    messages: unknown[];
  }
  export function convertToHtml(input: { arrayBuffer: ArrayBuffer }): Promise<ConvertToHtmlResult>;
  const mammoth: { convertToHtml: typeof convertToHtml };
  export default mammoth;
}
