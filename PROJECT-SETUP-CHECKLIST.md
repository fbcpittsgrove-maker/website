# Faith Baptist Church of Pittsgrove — setup checklist

Repo: fbcpittsgrove-maker/website · Slug `fbc-pittsgrove` · Port 3150 ·
Domains: https://fbcpittsgrove.church (prod, www → apex 308) ·
https://dev.fbcpittsgrove.church (develop) · registrar + DNS: Vercel ·
Region: Supabase `us-east-1` + Vercel `iad1` (confirmed 2026-10-26).

## Free-tier divergences from the playbook (approved 2026-10-26)

Verified against supabase.com/pricing and vercel.com/docs on 2026-10-26.

- **Supabase Free has no Branching** → two free projects instead of one
  project with `master`/`develop` branches: `fbc-pittsgrove` (prod) and
  `fbc-pittsgrove-dev` (dev). Migrations are pushed with the Supabase CLI
  (`supabase db push`, repo dev dependency), never the SQL editor or MCP.
- **Supabase Free has no leaked-password (HIBP) protection** → playbook §2.7
  skipped. TOTP MFA and custom SMTP are included on Free.
- **Supabase Free pauses a project after 1 week of inactivity** → a daily
  Vercel cron keeps prod awake (Hobby allows one run per day). Dev may pause;
  restore it from the dashboard.
- **Vercel Hobby has no custom environments** → `develop` is a Preview
  branch: `fbc-pittsgrove-dev.vercel.app` assigned to git branch `develop`,
  dev env vars scoped Preview + branch `develop`.
- **Vercel Hobby is non-commercial/personal use only** (fair use guidelines).
- **Scope**: public church site + light admin (users, events / sermons /
  announcements, roadmap board, owner issues + diagnostics, TOTP). Skipped:
  AI assistant, leads pipeline, email campaigns, usage analytics, chat, MCP.
- **Atlas wiring (§4.9)**: not wired — repo is outside The-Software-Effect org.

## Setup

- [x] Clone copied to `C:\CODE\fbc-pittsgrove`; Supabase CLI 2.122.0 +
      Vercel CLI 65.3.1 installed as dev dependencies [AI]
- [ ] Open `C:\CODE\fbc-pittsgrove` in WebStorm, start sessions from there,
      delete `C:\Users\DerekCoffey\website` [YOU]
- [x] Supabase: church-owned account + organization (Free) [YOU]
- [x] Supabase: signup project renamed `fbc-pittsgrove` (prod, ref
      `ihslguufjolijdyxuyll`); `fbc-pittsgrove-dev` created (ref
      `akydidlwrhjzkaaotail`), both `us-east-1`; dev keys + session pooler
      URL in `.env.local`, psql connection verified [AI]
- [ ] Reset the prod DB password (dashboard → Settings → Database) →
      `SUPABASE_PROD_DB_PASSWORD` in `.env.local` [YOU]
- [x] Vercel CLI signed in: team `FBCPittsgrove` (`fbcp-ittsgrove`, Hobby) [YOU]
- [ ] Supabase: 30-day personal access token → `SUPABASE_ACCESS_TOKEN` in
      `.env.local`; revoke after setup [YOU]
- [ ] Vercel: new Hobby account, linked to GitHub with access to
      `fbcpittsgrove-maker/website`; account token → `VERCEL_TOKEN` in
      `.env.local` [YOU]
- [ ] Photos into `design/photos/`; logo, service times, address, pastor/staff,
      beliefs, ministries, giving link from the Facebook page [YOU]
- [ ] `fbcpittsgrove-maker/website` in `env-vault/owners.txt` — commit + push
      the vault change [AI edit, YOU commit]
- [x] `.env.local` dev keys, site URL, peer secret → env-vault `sync.sh`
      ended `pushed`, `--check` shows `same` (re-sync once `SCHEMA_PEER_URL`
      is known) [AI]
- [x] Auth URL config both projects (dev: dev domain + `localhost:3150`;
      prod: prod domain only); TOTP enroll + verify ON on both [AI]
- [x] Vercel: project `fbc-pittsgrove` (`prj_dlx5eQbvjIqqg99WdHDzDtFLuGIM`),
      repo connected, protection OFF, region `iad1`, Node 24.x, prod domain
      `fbc-pittsgrove.vercel.app` (not suffixed), 6 Production env vars
      (non-sensitive) [AI]
- [x] After `master` + `develop` exist on GitHub: production branch →
      `master`, `fbc-pittsgrove-dev.vercel.app` → branch `develop`, Preview
      env vars for branch `develop` (Vercel rejects both until the branches
      exist) [AI]
- [x] Scaffold: Next 16.4, React 19.3, Tailwind 4, strict TS 6.0, ESLint 9,
      Vitest 5; `yarn run check` + `yarn build` green; auth + scanner-proof
      invites, TOTP, admin users, issues + diagnostics, roadmap board,
      events / sermons / announcements editor, interim public homepage,
      owner bootstrap migration, daily keepalive cron, Speed Insights, port
      guard on 3150 [AI]
- [x] Church seal from the Claude Design logo (`lib/logo.ts`): header/footer
      mark, `app/icon.svg`, `app/apple-icon.tsx`, share card [AI]
- [x] Domain: `fbcpittsgrove.church` bought through Vercel, live on prod;
      `dev.fbcpittsgrove.church` on `develop` [YOU + AI]
- [x] Design approved 2026-10-26: "Classic & warm" (cream, navy, burgundy,
      Cormorant Garamond + Source Sans 3); applied to site, login and admin [AI]
- [ ] Confirm church facts in `lib/church.ts` (pastors, address, service
      times, ministries, bus schedule); add phone/email [YOU]
- [x] Photos: adult/crowd photos only on the site (2026-10-26); originals in
      `design/photos/`, published copies in `public/images/` [AI]
- [ ] Parents' OK before any photo showing a child's face is published [YOU]
- [x] Design proposal from the photos + church branding, approved before the
      public pages are built [AI propose, YOU approve]
- [x] Git: `master` + `develop` pushed [YOU]
- [ ] GitHub: default branch `master`, ruleset `protect-master`, repo
      private [YOU]
- [x] `yarn supabase db push` to dev — 9 migrations, RLS on all 13 tables,
      owners seeded, anon reads content only (2026-10-26) [AI]
- [x] `yarn supabase db push` to prod — same 9 migrations, verified (2026-10-26) [AI]
- [x] Vercel: framework preset Next.js (CLI-created project had none), prod
      + dev deployments Ready, functions in iad1 [AI]
- [x] SEO per C:\CODElog-engine: titles/descriptions/canonicals, OG card,
      Church + Event JSON-LD, sitemap, AI-aware robots, llms.txt [AI]
- [x] Search Console: domain verified by DNS TXT, sitemap submitted
      (2026-10-26) [YOU + AI]
- [x] IndexNow: key file, ping on admin content save/delete (prod only),
      `scripts/indexnow-submit.mjs` for a whole-sitemap submit [AI]
- [ ] Bing Webmaster (import from Search Console); Google Business Profile
      for the church [YOU]
- [ ] Bootstrap sign-ins per project: Auth → Add user (password, Auto Confirm
      ON) for Manny + Derek — owner profiles seeded by migration [YOU]
- [ ] Verification pass (playbook §6, minus the Atlas step) [AI + YOU]

## Later

- [x] Custom domain `fbcpittsgrove.church` (bought on Vercel): apex canonical,
      www 308 → apex, `dev.` → develop; site + peer URLs in all scopes;
      Supabase auth URLs both projects; vault synced (2026-10-26) [AI]
- [ ] Resend (Free) on the custom domain: API key → both scopes + auth SMTP on
      both projects [YOU account/DNS, AI wiring]
