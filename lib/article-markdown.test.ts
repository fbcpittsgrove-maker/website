import { describe, expect, it } from "vitest";
import { articleHtml } from "@/lib/article-markdown";

describe("articleHtml", () => {
  it("renders real h2/h3 headings with ids", () => {
    const html = articleHtml("## Who is Jesus?\n\n### The Creator");
    expect(html).toContain('<h2 id="who-is-jesus"');
    expect(html).toContain('<h3 id="the-creator"');
  });

  it("joins consecutive quote lines into one blockquote", () => {
    const html = articleHtml("> Verily, verily,\n> I say unto you.\n\nAfter.");
    expect(html.match(/<blockquote/g)).toHaveLength(1);
    expect(html).toContain("<p>Verily, verily,</p><p>I say unto you.</p></blockquote><p>After.</p>");
  });

  it("renders bulleted and numbered lists separately", () => {
    const html = articleHtml("- a\n- b\n\n1. one\n2. two");
    expect(html).toContain('<ul class="list-disc');
    expect(html).toContain('<ol class="list-decimal');
    expect(html).toContain("<li>b</li>");
  });

  it("links https in a new tab and site paths in place", () => {
    const html = articleHtml("[Visit](/visit) and [KJV](https://www.kingjamesbibleonline.org/)");
    expect(html).toContain('<a href="/visit" class=');
    expect(html).toContain('href="https://www.kingjamesbibleonline.org/" target="_blank" rel="noopener noreferrer"');
  });

  it("never treats a protocol-relative link as a site path", () => {
    const html = articleHtml("[x](//2130706433)");
    expect(html).not.toContain("<a ");
  });

  it("escapes HTML instead of passing it through", () => {
    const html = articleHtml('<script>alert(1)</script> [x](javascript:alert(1))');
    expect(html).not.toContain("<script>");
    expect(html).not.toContain('href="javascript');
    expect(html).toContain("&lt;script&gt;");
  });
});
