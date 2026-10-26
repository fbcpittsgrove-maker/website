/** Role vocabulary + labels, client-safe — profile.ts re-exports these for
 *  server code; client components import from here so the browser bundle
 *  never touches the cookie-reading auth stack. */

export type Role = "admin" | "editor";

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  editor: "Editor",
};
