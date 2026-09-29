# StitchPro — Handoff / Continuation Notes

_Last updated: 2026-09-29. Written for a fresh AI agent picking this project up in a
new chat/session. Read this whole file before doing anything._

If you're an agent reading this: the user will clone this repo and ask you to read
this file to get up to speed. Assume you have **no prior memory** of this project.
Everything you need to keep working productively is below.

---

## 1. What this project is

**StitchPro** is a commercial embroidery-digitizing SaaS product: users upload
artwork, the app converts it into real embroidery machine stitch files (DST format
first, more formats later), and lets them manage designs, production jobs, machines,
thread inventory, etc. It's built as two separate repos:

| Repo | Purpose | URL |
|---|---|---|
| `stitch-pro` | Frontend — Expo/React Native app (this repo, exports to web + will target iOS/Android) | `https://github.com/useeman32-design/stitch-pro` |
| `stitchpro-backend` | Backend — Python/Flask embroidery digitizing engine | `https://github.com/useeman32-design/stitchpro-backend` |

Both belong to the user's real GitHub account (`useeman32-design`). The frontend is
also deployed as a live static web build via GitHub Pages:

**Live URL: `https://useeman32-design.github.io/stitch-pro/`** (served from the
`gh-pages` branch, root path `/`).

The user's environment: they are non-technical-ish (communicates in plain language,
doesn't want to run terminal commands themselves) and expects the agent to build,
verify, and deploy changes for them, then just tell them to check the live URL.

---

## 2. Standing instructions from the user — do these without being asked

1. **Auto-push after every meaningful change.** The user explicitly said: "anytime
   you finished an update can push it directly." Don't wait to be asked — after any
   real code change, commit + push to `main` on the relevant repo(s), and if it's a
   frontend change, also rebuild and redeploy to GitHub Pages (see §4). Tell the user
   afterward what you did and give them the live URL to check.
2. **Never ask the user to resend the GitHub token.** It's already stored on disk
   (see §3). Only ask again if that file is confirmed missing/invalid.
3. **Never echo the raw token value in a chat reply.** It's fine that it appears in
   a tool's own stdout/logs during a deploy — just don't repeat it in your written
   response to the user.
4. The user is on Lagos/Nigeria network conditions and has repeatedly reported
   "still seeing the old version" after deploys that check out fine server-side —
   see §5 (Known pitfalls) before assuming a deploy is confirmed good. Prefer to
   verify with a real headless-browser load against the live URL, not just header/
   hash comparisons, and always give the user a cache-busting URL
   (`?nocache=<random>`) to test with, since GitHub Pages' CDN (Fastly) caches
   per-edge-region for up to 10 minutes and browsers cache the HTML too.

---

## 3. Credentials & environment quirks (READ THIS BEFORE TRYING TO PUSH ANYTHING)

### If you are running in the same kind of sandboxed agent environment as before
(Arena.ai Agent Mode, an ephemeral Linux sandbox rooted at `/home/user`), the
following **are wiped between conversation turns and must be redone every time
you need them**, even if they worked earlier in the same session:

- `git remote` entries (`.git/config`) — every turn that needs to push must
  re-add `origin` with an embedded token before pushing.
- `node_modules` in both repos — must run `npm install` fresh.
- Any pip-installed tools (e.g. `playwright` + its downloaded Chromium) — must
  reinstall (`pip install playwright && python3 -m playwright install --with-deps
  chromium`) each time before using them.
- The `gh-pages` npm package's local clone cache at
  `stitch-pro/node_modules/.cache/gh-pages/` — gets wiped along with
  `node_modules`, so it's always a fresh clone; no special handling needed, just
  don't assume it has any state from a previous turn.

**Regular tracked files and anything else under `/home/user` DO persist** across
turns (including this repo's git history/commits, and files outside the repos like
the credentials file below).

### Where the GitHub token lives

There is a file **outside both git repos** (never committed, already gitignored):

```
/home/user/.stitchpro-deploy.json
```

Structure:
```json
{
  "github_token": "ghp_...",
  "repos": {
    "stitch-pro": {
      "path": "/home/user/stitch-pro",
      "url": "https://github.com/useeman32-design/stitch-pro.git",
      "default_branch": "main",
      "pages_branch": "gh-pages"
    },
    "stitchpro-backend": {
      "path": "/home/user/stitchpro-backend",
      "url": "https://github.com/useeman32-design/stitchpro-backend.git",
      "default_branch": "main"
    }
  }
}
```

**If this file exists and has a valid token, use it — do not ask the user to send
the token again.** If it's missing (e.g. you're in a brand new environment that
never had it, like a different machine after the user "clones the repo" somewhere
else entirely), ask the user for a GitHub Personal Access Token with repo access,
then recreate this file yourself (chmod 600, outside the repo, add its path to
`.gitignore` if not already) so you don't have to ask again mid-session.

### Standard push pattern (do this at the start of any turn that needs to push)

```bash
cd /home/user/stitch-pro   # or stitchpro-backend
TOKEN=$(python3 -c "import json; print(json.load(open('/home/user/.stitchpro-deploy.json'))['github_token'])")
REPO_URL=$(python3 -c "import json; print(json.load(open('/home/user/.stitchpro-deploy.json'))['repos']['stitch-pro']['url'])")
AUTHED_URL=$(echo "$REPO_URL" | sed -E "s#https://#https://x-access-token:${TOKEN}@#")
git remote add origin "$AUTHED_URL" 2>/dev/null || git remote set-url origin "$AUTHED_URL"
git push origin main
git remote set-url origin "$REPO_URL"   # scrub the token back out afterward (defense in depth)
```

---

## 4. Deploying the frontend to GitHub Pages

### ⚠️ Critical bug already found and fixed — do not reintroduce it

The `gh-pages` npm package's CLI flags are easy to get wrong:

- `-d, --dist <dir>` = the local build folder to publish (e.g. `dist`)
- `-b, --branch <branch>` = which branch to push to (defaults to `gh-pages` already)
- `-e, --dest <dir>` = a **subdirectory within the target branch** to publish into —
  **this is NOT the branch name**, despite how it reads.

An earlier version of this project's `package.json` deploy script used `-e gh-pages`
thinking it selected the branch. It actually made every deploy silently publish into
an unused `<branch-root>/gh-pages/` subfolder, while the actual served root kept
whatever was there from before that mistake — so the live site looked permanently
stale no matter how many times a "successful" deploy ran. This was hard to catch
because file hashes/timestamps on the (wrong, nested) files matched the local build
perfectly; only a real functional browser test against the live root URL exposed it.

**The fix is already applied** in `package.json`:
```json
"deploy": "gh-pages --nojekyll --dotfiles -d dist -b gh-pages"
```
If you ever see `-e gh-pages` (or `-e` with any branch-sounding value) in a deploy
command anywhere, that's the bug — fix it to `-b gh-pages` and drop `-e` entirely
(it correctly defaults to the branch root, `.`).

### Standard deploy procedure

```bash
cd /home/user/stitch-pro
npm install --no-audit --no-fund
rm -rf dist
npx expo export -p web
# (optional but recommended) sanity-check the fresh bundle contains your change:
grep -c "some distinctive string from your change" dist/_expo/static/js/web/entry-*.js

# get token/url as in §3, then:
rm -rf node_modules/.cache/gh-pages   # force a clean clone, avoid any stale-cache surprises
npx gh-pages --nojekyll --dotfiles -d /home/user/stitch-pro/dist -b gh-pages -r "$AUTHED_URL"
```

### Verifying a deploy actually worked (do all of these, not just one)

1. **Confirm via GitHub's API** (not `raw.githubusercontent.com`, which can lag)
   that the `gh-pages` branch's `index.html` references the same JS entry hash as
   your fresh local `dist/index.html`:
   ```bash
   curl -s -H "Authorization: token $TOKEN" \
     "https://api.github.com/repos/useeman32-design/stitch-pro/contents/index.html?ref=gh-pages" \
     | python3 -c "import json,sys,base64,re; d=json.load(sys.stdin); print(re.findall(r'_expo/static/js/web/entry-[a-z0-9]+\.js', base64.b64decode(d['content']).decode()))"
   ```
2. **Then actually load the live URL with a real headless browser** (Playwright) and
   confirm the change is visually/functionally there. Hash-matching alone was proven
   insufficient once already in this project (see §5) — always do the live check too.
3. Give the user a cache-busting link, e.g. `https://useeman32-design.github.io/stitch-pro/?nocache=12345`,
   since GitHub Pages' CDN (Fastly) caches HTML responses (`Cache-Control: max-age=600`)
   **per edge region** — the user (Lagos) may hit a different, still-stale edge than
   whatever region your own checks hit, even minutes after a real fix landed.

### Local preview before deploying (recommended)

The app is built with a GitHub Pages sub-path base URL (`app.json` →
`expo.experiments.baseUrl = "/stitch-pro"`), so if you want to preview the static
export locally before deploying, you must serve it under that same sub-path or
asset URLs will 404:

```bash
mkdir -p /tmp/pages_root/stitch-pro
cp -r dist/* /tmp/pages_root/stitch-pro/
python3 -m http.server 8090 --directory /tmp/pages_root
# then browse to http://localhost:8090/stitch-pro/
```
(Running the normal `expo start --web` dev server also works but is heavy — it has
OOM-killed itself in this sandbox before. Prefer the static-export-and-serve method
above for quick visual checks.)

---

## 5. Known pitfalls / things that already burned time — don't repeat them

- **Don't trust HTTP header/hash comparisons alone as proof a deploy is correct.**
  This project had a real bug (the `-e` vs `-b` flag mistake above) where hash and
  `Last-Modified` comparisons matched perfectly between "the live site" and "the
  gh-pages branch" — because both were consistently comparing the same *stale* root
  content. It took an actual Playwright browser session driving the real user flow
  (clicking through screens, attempting a real file download) to expose that nothing
  had actually changed. Always do a live functional check, not just a header diff.
- **`pointerEvents` must be passed as a React Native component PROP, not nested
  inside a `style` object**, when you need `'box-none'` (or `'box-only'`) semantics.
  `style={{ pointerEvents: 'box-none' }}` silently does nothing useful on web (falls
  back to `auto`, which is NOT what you want) because `box-none` isn't valid CSS.
  Use `<View style={styles.x} pointerEvents="box-none">` instead. A bug exactly like
  this in `CreateButton.tsx` caused the floating center "+" button's invisible
  touch-target to swallow taps meant for the neighboring nav buttons.
- **`overflow: 'hidden'` on a rounded glassy container will clip any absolutely
  positioned child that intentionally pokes outside its bounds** (e.g. a floating
  action button meant to overlap the top edge of a nav bar). If something needs to
  visually float above/outside a clipped container, render it as a *sibling*
  positioned relative to a non-clipped wrapper, not as a child of the clipped one.
- **A `useRef` value does not trigger a re-render when mutated.** If a ref's value
  needs to affect what's conditionally rendered in JSX (e.g. "has this been
  measured yet, so show the animated indicator"), use `useState` instead, or the UI
  can lag a full render cycle behind reality.
- **`react-native-reanimated` and `expo-blur` are already installed** — no need to
  re-evaluate alternatives; `expo-blur`'s `BlurView` renders via CSS
  `backdrop-filter` on web and works fine in the static export.
- **cPanel "Setup Python App" (Phusion Passenger/WSGI) was confirmed present** on
  the user's hosting plan — this is why the backend targets Flask + `a2wsgi`-style
  WSGI deployment rather than a VPS. Passenger only supports WSGI apps (no raw
  ASGI, no standalone background daemons/long-running workers) — keep that
  constraint in mind for any backend architecture decisions.

---

## 6. Frontend (`stitch-pro`) — structure & recent work

- Expo SDK ~57, Expo Router (file-based routing under `src/app/`), TypeScript,
  React Native Web for the browser build. Read `AGENTS.md` in this repo root for
  general Expo conventions (it's already tuned for this project — follow it).
- Key layout files:
  - `src/components/layout/AppShell.tsx` — top-level shell; branches to a desktop
    sidebar layout or a mobile layout with the floating bottom nav.
  - `src/components/layout/BottomNavigation.tsx` — the mobile bottom tab bar.
  - `src/components/layout/CreateButton.tsx` — the floating circular "+" button
    centered in the bottom nav.
- **Bottom nav redesign (done, deployed, bugs fixed):** it now floats above the
  bottom edge with margin, has full rounded corners, a frosted/glassy translucent
  background (indigo-tinted, via `expo-blur` + `backdrop-filter`), and an animated
  indigo highlight pill (Reanimated spring) that glides between tabs. The center
  "+" button is a true circle and floats cleanly above the bar without being
  clipped. Bugs that were found and fixed (see §5 for the general lessons):
  create-button clipping, non-circular radius, broken `pointerEvents`, and a
  stale-ref animation bug. **Last known-good state was verified live** via
  Playwright: all four tabs (Home/Designs/Jobs/More) navigate reliably, and the
  button renders as an unclipped circle. If the user reports it's *still* broken
  after all this, the most likely next suspects are: (a) they're looking at a
  cached version (see §5.1/§2.4 on CDN caching), or (b) a genuine
  browser-specific rendering difference (e.g. Safari's handling of
  `overflow:hidden` + `border-radius` + `backdrop-filter` combos is historically
  inconsistent) that a Chromium-based Playwright check won't catch — ask for a
  screenshot and the exact browser/device if this comes up again.
- **Real DST file download (done, deployed):** the auto-digitize flow
  (`src/app/(app)/create/auto-digitize/success.tsx`) generates a real, valid
  Tajima DST file client-side via `src/utils/dstWriter.ts` and triggers an actual
  browser file download (Blob + `<a download>`) when the user taps the DST format
  chip. Other formats (PES/JEF/EXP/VP3/HUS) intentionally show an "isn't wired up
  yet" toast — only DST is real so far. Verified with a real Playwright download
  event on the live GitHub Pages URL (downloaded file had valid DST header
  fields: stitch count, color count, etc.).
- Design tokens live in `src/theme/tokens.ts` (colors, spacing, radius, typography,
  shadows, sizes) — always import from there, never hardcode raw values, per the
  codebase's own convention.

---

## 7. Backend (`stitchpro-backend`) — structure & status

- Python. `api/app.py` (Flask), `digitizer/model.py` (internal embroidery data
  model — the *only* representation the rest of the backend should use; nothing
  outside `formats/dst/writer.py` should touch a raw pyembroidery `EmbPattern` or
  DST bytes directly), `formats/` (format read/write layer), `passenger_wsgi.py`
  (entry point for cPanel's Phusion Passenger hosting).
- `requirements.txt`: `flask`, `pyembroidery`, `pillow`, `shapely`. Plan is to also
  add `scikit-image` for Milestone 5 (contour/connected-component detection,
  replacing what OpenCV would normally do — OpenCV itself was ruled out as too
  heavy/unreliable to install on constrained shared hosting; the
  Pillow+Shapely+scikit-image combo was chosen instead and accepted by the user).
  Re-test scikit-image's SciPy dependency once the actual cPanel Python App
  environment is provisioned, since that's the piece most likely to have trouble
  on constrained shared hosting.
- **Third-party license decisions already made** (see
  `docs/THIRD_PARTY_LICENSES.md` for full detail):
  - `pyembroidery` (MIT) — ✅ use directly as the DST/format read-write layer. Do
    not reimplement binary format encoding by hand.
  - `libembroidery` (zlib) — not needed; pyembroidery already covers everything
    in Python.
  - `Ink/Stitch` (GPL-3.0) and `PEmbroider` (GPL-3.0 + Anti-Capitalist Software
    License, which explicitly forbids commercial embroidery-digitizing software)
    — **reference/conceptual reading only, never copy or closely mirror their
    code.** PEmbroider in particular is legally radioactive for this project.
- **Milestone 1 (running/straight stitch pipeline): done and verified.**
  **Milestone 2 (satin stitch): not started yet — this is the next backend
  engine milestone to pick up.** `ObjectType` enum in `digitizer/model.py`
  already has `RUNNING`, `SATIN`, `FILL` defined (with `COLUMN`/`APPLIQUE`/
  `SPECIAL` reserved for later per the original project brief's §8), but only
  the running-stitch path has real logic behind it so far.
- Hosting: Python/Flask via cPanel's "Setup Python App" (Passenger/WSGI) — user
  confirmed their plan has this option, so no VPS pivot is needed. Remember the
  WSGI-only constraint from §5 when adding anything backend-side.

---

## 8. Suggested next steps (pick up here)

1. If the user reports the bottom-nav bugs are still happening after everything
   in §6, get a screenshot + exact browser/device before changing anything
   further — don't guess blindly at more CSS tweaks.
2. Backend Milestone 2: implement satin stitch generation in `digitizer/model.py`
   / the digitizing pipeline, following the same data-model discipline (stitch
   plan → `formats/dst/writer.py` → pyembroidery, nothing bypasses that layering).
   Use `research/inkstitch-notes.md` as a conceptual reference for satin column
   algorithms (rails + zigzag + underlay types + pull compensation) — reimplement
   independently, never port Ink/Stitch's actual (GPL) code.
3. Once satin is in, re-run the full push/deploy loop for both repos as usual.
4. Revisit the `scikit-image`/SciPy hosting question once the user's actual
   cPanel Python App environment exists, before committing further to that
   stack for Milestone 5.
