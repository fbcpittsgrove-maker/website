import { describe, expect, it } from "vitest";
import {
  MAX_PINNED,
  formatTimestamp,
  parseDraftFile,
  parsePostForm,
  parseTimestamp,
  pinProblem,
  postPath,
  publishProblems,
  slugify,
  wordCount,
  type GateInput,
} from "@/lib/posts";

const DRAFT = `---
kind: sermon
title: "The Promise of Heaven: What Jesus Said in John 5:24"
slug: the-promise-of-heaven-john-5-24
preached_on: 2026-10-25
---

# The Promise of Heaven: What Jesus Said in John 5:24

*A Sunday morning message from John chapter 5*

## What does "verily, verily" mean?

It means amen, amen.

---

<!--
REVIEWER NOTES (not published):
1. Confirm the preacher.
-->
`;

describe("parseDraftFile", () => {
  it("splits front matter, body and reviewer notes", () => {
    const d = parseDraftFile(DRAFT);
    expect(d.meta).toEqual({
      kind: "sermon",
      title: "The Promise of Heaven: What Jesus Said in John 5:24",
      slug: "the-promise-of-heaven-john-5-24",
      preached_on: "2026-10-25",
    });
    expect(d.notes).toBe("1. Confirm the preacher.");
  });

  it("drops the body's own title line and the trailing rule", () => {
    const { body } = parseDraftFile(DRAFT);
    expect(body.startsWith("*A Sunday morning message")).toBe(true);
    expect(body).not.toMatch(/^# /m);
    expect(body.endsWith("It means amen, amen.")).toBe(true);
  });

  it("reads Windows line endings the same", () => {
    expect(parseDraftFile(DRAFT.replace(/\n/g, "\r\n"))).toEqual(parseDraftFile(DRAFT));
  });

  it("refuses a file with no front matter or a malformed line", () => {
    expect(() => parseDraftFile("# Just a title")).toThrow("Draft has no front matter block");
    expect(() => parseDraftFile("---\nnot a pair\n---\nbody")).toThrow("Bad front matter line: not a pair");
  });

  it("allows an idea with no body", () => {
    const d = parseDraftFile('---\nkind: question\nstatus: idea\nquestion: "Will we know each other in heaven?"\n---\n');
    expect(d.body).toBe("");
    expect(d.meta.status).toBe("idea");
  });
});

describe("timestamps", () => {
  it("parses and formats both ways", () => {
    expect(parseTimestamp("00:12:34")).toBe(754);
    expect(parseTimestamp("12:34")).toBe(754);
    expect(formatTimestamp(754)).toBe("12:34");
    expect(formatTimestamp(3723)).toBe("1:02:03");
  });

  it("refuses something that is not a timestamp", () => {
    expect(() => parseTimestamp("754")).toThrow("Not a timestamp: 754");
  });
});

describe("slugs and paths", () => {
  it("slugifies a title", () => {
    expect(slugify("Can Good Works Get You Into Heaven?")).toBe("can-good-works-get-you-into-heaven");
    expect(slugify("What Does ‘Verily, Verily’ Mean?")).toBe("what-does-verily-verily-mean");
  });

  it("routes each kind to its own section", () => {
    expect(postPath("sermon", "a-b")).toBe("/sermons/a-b");
    expect(postPath("question", "a-b")).toBe("/questions/a-b");
  });
});

describe("parsePostForm", () => {
  const base = { title: "T", slug: "a-title", description: "", question: "", body_md: "", reviewer_notes: "" };

  it("trims and accepts a valid save", () => {
    expect(parsePostForm("sermon", { ...base, title: "  A title  " })).toEqual({ ok: true, value: { ...base, title: "A title" } });
  });

  it("refuses a bad web address and a question page with no question", () => {
    expect(parsePostForm("sermon", { ...base, slug: "Not OK" }).ok).toBe(false);
    expect(parsePostForm("question", base)).toEqual({ ok: false, error: "Question is required." });
  });
});

describe("publishProblems", () => {
  const words = (n: number) => Array.from({ length: n }, () => "word").join(" ");
  const ready: GateInput = {
    kind: "sermon",
    title: "The Promise of Heaven: What Jesus Said in John 5:24",
    description: "Jesus said whoever hears His word and believes on the Father who sent Him has everlasting life. A Sunday morning message on being sure of heaven.",
    question: "",
    body_md: `## Section\n\n${words(600)}`,
    sermon: { preacher: "Steven Bradbury", title: "The Promise of Heaven" },
  };

  it("passes a complete post", () => {
    expect(publishProblems(ready)).toEqual([]);
  });

  it("holds the title and search summary to their lengths", () => {
    const p = publishProblems({ ...ready, title: "Too short", description: "Short." });
    expect(p).toContain("Title should be 30–60 characters (now 9).");
    expect(p).toContain("Search summary should be 120–160 characters (now 6).");
  });

  it("blocks an unconfirmed preacher and leftover markers", () => {
    expect(publishProblems({ ...ready, sermon: { preacher: "CONFIRM: Steven?", title: "x" } })).toEqual([
      "Confirm who preached this sermon on the Sermons page.",
    ]);
    expect(publishProblems({ ...ready, body_md: `${ready.body_md}\nTODO check verse` })).toEqual([
      "The post still has a CONFIRM, TODO or note marker in it.",
    ]);
  });

  it("blocks a body that repeats the title as a heading, or is too short", () => {
    expect(publishProblems({ ...ready, body_md: `# Title\n\n${words(600)}` })).toContain(
      "Remove the top-level “# ” heading — the page already shows the title.",
    );
    expect(publishProblems({ ...ready, body_md: words(100) })).toContain("The post needs at least 500 words (now 100).");
  });

  it("needs a question on a question page and a sermon on a sermon post", () => {
    expect(publishProblems({ ...ready, kind: "question", body_md: words(300) })).toEqual(["A question page needs its question."]);
    expect(publishProblems({ ...ready, sermon: null })).toEqual(["Link the post to its sermon."]);
  });

  it("counts words, not markdown symbols", () => {
    expect(wordCount("## Who is Jesus?\n\n> **He is** the Creator.\n- one")).toBe(8);
  });
});

describe("pinProblem", () => {
  it("pins a published post while there is room", () => {
    expect(pinProblem("sermon", "published", 0)).toBeNull();
    expect(pinProblem("question", "published", MAX_PINNED - 1)).toBeNull();
  });

  it("refuses a post that is not on the website", () => {
    for (const status of ["idea", "draft", "needs_changes"] as const) {
      expect(pinProblem("question", status, 0)).toMatch(/on the website/);
    }
  });

  it("caps pinned posts per kind", () => {
    expect(pinProblem("sermon", "published", MAX_PINNED)).toBe("Only 3 sermon posts can be pinned at once. Unpin one first.");
    expect(pinProblem("question", "published", MAX_PINNED)).toBe("Only 3 question pages can be pinned at once. Unpin one first.");
  });
});
