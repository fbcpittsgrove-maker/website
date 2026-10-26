/** Attachment rules shared by every uploader. Client-safe: no Node APIs. */

export const ATTACH_MAX_BYTES = 25 * 1024 * 1024;
export const ATTACH_MAX_FILES = 10;

/** Documents, sheets, decks, images, text. Nothing executable. */
export const ATTACH_EXTENSIONS = [
  "pdf", "doc", "docx", "xls", "xlsx", "csv", "ppt", "pptx",
  "png", "jpg", "jpeg", "gif", "webp", "heic",
  "txt", "md", "html", "eml", "zip",
] as const;

/** Short badge label per type, drawn in the app's own typography. */
export const ATTACH_LABEL: Record<string, string> = {
  pdf: "PDF", doc: "DOC", docx: "DOC", xls: "XLS", xlsx: "XLS", csv: "CSV",
  ppt: "PPT", pptx: "PPT", png: "IMG", jpg: "IMG", jpeg: "IMG", gif: "IMG",
  webp: "IMG", heic: "IMG", txt: "TXT", md: "MD", html: "HTML", eml: "EML", zip: "ZIP",
};

export function attachExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot + 1).toLowerCase();
}

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "heic"]);

export function attachIsImage(name: string): boolean {
  return IMAGE_EXTENSIONS.has(attachExtension(name));
}

/** The one specific reason a file can't come aboard, or null if it can. */
export function attachProblem(name: string, sizeBytes: number): string | null {
  const ext = attachExtension(name);
  if (!(ATTACH_EXTENSIONS as readonly string[]).includes(ext))
    return `${name}: .${ext || "?"} files aren't accepted here.`;
  if (sizeBytes <= 0) return `${name} is empty — nothing to upload.`;
  if (sizeBytes > ATTACH_MAX_BYTES) return `${name} is over the 25MB limit.`;
  return null;
}

/** Storage-safe version of a client file name — the original stays on the row. */
export function attachSafeName(name: string): string {
  return name.replace(/[^\w.\- ]+/g, "_").replace(/\s+/g, " ").trim() || "file";
}
