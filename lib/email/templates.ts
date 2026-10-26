import { BRAND } from "@/lib/brand";

const body = BRAND.bodyFont.replaceAll('"', "'");
const display = body;

/** HTML-escape user-supplied text before it lands in a template. */
export const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);

/**
 * Transactional templates are code. base() wraps every send: 600px table,
 * all styles inline, palette from the brand module (never re-typed), hidden
 * preheader for the inbox snippet, and color-scheme: light so Outlook and
 * dark mode never invert the card. System font stack — email clients
 * render it everywhere.
 */
export function base(content: string, preheader: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${BRAND.name}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.paper};">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.paper};padding:40px 16px;">
<tr><td align="center">

  <!-- brand header -->
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;">
    <tr><td style="padding:0 4px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0">
        <tr>
          <td style="width:40px;height:40px;background:${BRAND.accent};border-radius:12px;text-align:center;vertical-align:middle;">
            <span style="font-family:${display};font-size:15px;font-weight:700;color:${BRAND.surface};line-height:40px;">${BRAND.short}</span>
          </td>
          <td style="padding-left:12px;vertical-align:middle;">
            <div style="font-family:${display};font-size:16px;font-weight:700;color:${BRAND.ink};letter-spacing:-0.01em;">${BRAND.name}</div>
            <div style="font-family:${body};font-size:11px;color:${BRAND.muted};letter-spacing:0.06em;text-transform:uppercase;">${BRAND.place}</div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>

  <!-- card -->
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:${BRAND.surface};border:1px solid ${BRAND.line};border-radius:16px;overflow:hidden;">
    <tr><td style="height:2px;background:${BRAND.accent};font-size:0;line-height:0;">&nbsp;</td></tr>
    <tr><td style="padding:36px 40px;font-family:${body};font-size:15px;line-height:1.65;color:${BRAND.text};">
      ${content}
    </td></tr>
    <tr><td style="padding:20px 40px;border-top:1px solid ${BRAND.line};font-family:${body};font-size:11px;line-height:1.5;color:${BRAND.muted};">
      ${BRAND.name}<br>${BRAND.place}
    </td></tr>
  </table>

</td></tr>
</table>
</body>
</html>`;
}

export function heading(text: string): string {
  return `<h1 style="margin:0 0 16px;font-family:${display};font-size:22px;font-weight:700;line-height:1.3;color:${BRAND.ink};letter-spacing:-0.01em;">${text}</h1>`;
}

export function paragraph(text: string): string {
  return `<p style="margin:0 0 16px;font-family:${body};font-size:15px;line-height:1.65;color:${BRAND.text};">${text}</p>`;
}

export function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;"><tr><td style="background:${BRAND.accent};border-radius:8px;">
<a href="${href}" style="display:inline-block;padding:13px 28px;font-family:${body};font-size:14px;font-weight:600;letter-spacing:0.01em;color:${BRAND.surface};text-decoration:none;border-radius:8px;">${label}</a>
</td></tr></table>`;
}

/** Small all-caps eyebrow above a heading, in the brand signal colour. */
export function eyebrow(text: string): string {
  return `<p style="margin:0 0 8px;font-family:${body};font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:${BRAND.accent};">${text}</p>`;
}
