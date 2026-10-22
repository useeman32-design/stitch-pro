# StitchPro — Handoff / Continuation Notes

_Last updated: 2026-10-22, later same day (user tested on GitHub Pages after
waking up and reported a real bug; fixed, verified live, see §6)._

_Originally written: 2026-10-22 (overnight autonomous session, while the user slept).
Written for a fresh AI agent picking this project up in a new chat/session.
Read this whole file before doing anything — it supersedes the 2026-09-29
version of this file (kept below in spirit, not literally; a lot has changed)._

If you're an agent reading this: the user will say something like "pull
updates and test" after waking up. Assume you have **no prior memory** of
this project. Everything you need to keep working productively is below.

---

## 1. What this project is

**StitchPro** is a commercial embroidery-digitizing SaaS product: users
upload artwork, the app converts it into real embroidery machine stitch
files (DST/PES/JEF/EXP/VP3), and lets them manage designs, production jobs,
machines, thread inventory, etc. Two separate repos:

| Repo | Purpose | URL |
|---|---|---|
| `stitch-pro` | Frontend — Expo/React Native app (this repo), exports to web, targets iOS/Android too | `https://github.com/useeman32-design/stitch-pro` |
| `stitchpro-backend` | Backend — Python/Flask embroidery digitizing engine | `https://github.com/useeman32-design/stitchpro-backend` |

Live web build: **`https://useeman32-design.github.io/stitch-pro/`** (GitHub
Pages, `gh-pages` branch). Both repos belong to the user's real GitHub
account (`useeman32-design`).

The user is non-technical-ish, communicates in plain language, and expects
the agent to build/verify/deploy changes, then just say "check the live
URL" or "pull and test".

---

## 2. Standing instructions — do these without being asked

1. **Auto-push after every meaningful change**, to the relevant repo's
   `main`. If it's a frontend change, **also rebuild and redeploy to GitHub
   Pages** (see §4) — don't wait to be asked.
2. **Never ask the user to resend the GitHub token.** It's on disk (§3).
3. **Never echo the raw token value in a chat reply.**
4. Give a cache-busting URL (`?nocache=<random>`) when pointing the user at
   the live site — GitHub Pages' CDN caches per edge region for ~10 min.
5. Use `git commit -F <tmpfile>` for multi-line commit messages, **not**
   `git commit -m "..."` with a message containing backticks — backticks
   inside a double-quoted `-m` string get shell-expanded as command
   substitution and silently corrupt/abort the commit. (Hit this exact bug
   this session; caught it because the commit didn't appear in `git log`.)

---

## 3. Credentials & environment quirks (READ BEFORE PUSHING ANYTHING)

This is an ephemeral Arena.ai Agent Mode sandbox rooted at `/home/user`.
**These are wiped between conversation turns/snapshot restores and must be
redone every time, even if they worked earlier in the same session:**

- `git remote` entries (`.git/config`) — re-add `origin` with an embedded
  token before every push.
- `node_modules` in both repos — `npm install` fresh.
- **Node version**: the sandbox's default `node` is v20.20.2, but
  `react-native@0.88`/`metro-transform-worker@0.87` (from the SDK 58
  upgrade) require Node `^22.13 || ^24.3 || >=26`. `~/.nvm` does **not**
  survive a snapshot restore either — if `nvm: command not found` or
  `EBADENGINE` warnings show up, reinstall it:
  ```bash
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
  export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm install 22
  ```
  then `nvm use 22` before any `npm install`/`npx expo`/`npx tsc` command.
  `start_expo.sh` already does the `nvm use 22` part, just not the install.
- **Python venvs** (`stitchpro-backend/venv`): the `venv/bin/python3`
  *binary* (a symlink to the system interpreter) can go missing after a
  snapshot restore even though `venv/lib/.../site-packages` is intact,
  causing `ModuleNotFoundError: flask` even though flask shows as
  installed. Don't try to repair it — just rebuild:
  ```bash
  cd stitchpro-backend && rm -rf venv && python3 -m venv venv && venv/bin/pip install -r requirements.txt
  ```
- Playwright + its Chromium download (used for live-site verification) —
  reinstall each session: `pip install playwright && python3 -m playwright
  install --with-deps chromium`.
- The `gh-pages` npm package's local clone cache at
  `stitch-pro/node_modules/.cache/gh-pages/` — always wiped with
  `node_modules`; no special handling needed.

**Regular tracked git files and anything else under `/home/user` DO
persist** across turns (commit history, files outside the repos, etc).

### Where the GitHub token lives

`/home/user/.stitchpro-deploy.json` (outside both repos, gitignored):
```json
{
  "github_token": "ghp_...",
  "repos": {
    "stitch-pro": { "path": "/home/user/stitch-pro", "url": "https://github.com/useeman32-design/stitch-pro.git", "default_branch": "main", "pages_branch": "gh-pages" },
    "stitchpro-backend": { "path": "/home/user/stitchpro-backend", "url": "https://github.com/useeman32-design/stitchpro-backend.git", "default_branch": "main" }
  }
}
```
If it exists and has a valid token, use it — don't ask the user to resend.
If missing entirely, ask for a new PAT and recreate this file.

### Standard push pattern

```bash
cd /home/user/stitch-pro   # or stitchpro-backend
TOKEN=$(python3 -c "import json; print(json.load(open('/home/user/.stitchpro-deploy.json'))['github_token'])")
REPO_URL=$(python3 -c "import json; print(json.load(open('/home/user/.stitchpro-deploy.json'))['repos']['stitch-pro']['url'])")
AUTHED_URL=$(echo "$REPO_URL" | sed -E "s#https://#https://x-access-token:${TOKEN}@#")
git remote remove origin 2>/dev/null; git remote add origin "$AUTHED_URL"
git fetch origin main   # ALWAYS do this before pushing -- see the IMPORTANT note below
git push origin main
git remote set-url origin "$REPO_URL"   # scrub the token back out afterward
```

**IMPORTANT — check for remote/local drift before assuming "uncommitted
changes" are actually uncommitted.** This exact session hit a case where
the working tree had real, uncommitted-looking changes that turned out to
already be pushed to `origin/main` under a *later* commit than local HEAD
(a snapshot-restore artifact: the working tree files were current, but the
local `.git` history had rewound). Before building on top of what looks
like uncommitted work, always `git fetch origin <branch>` and diff:
```bash
git log --oneline HEAD..origin/main   # is origin ahead of local HEAD?
git add -A && git diff --cached origin/main --stat   # is the working tree already == origin?
```
If the working tree already matches `origin/main` exactly (or differs only
by files you can cleanly re-derive), `git reset --hard origin/main` to
resync, then reapply only the genuinely new work as a fresh commit. **Don't
`git reset --hard` with anything valuable only staged and not committed —
it discards staged-but-uncommitted new files along with tracked-file
changes.** (If that happens, the blob may still be recoverable via `git
fsck --unreachable | grep blob` + `git cat-file blob <sha> > path`, which
is how an accidentally-reset PNG was recovered this session.)

---

## 4. Deploying the frontend to GitHub Pages

### ⚠️ Critical bug already found and fixed — do not reintroduce it

`gh-pages`'s `-e/--dest` flag is a **subdirectory within the target
branch**, not the branch name. The fixed, correct deploy script in
`package.json`:
```json
"deploy": "gh-pages --nojekyll --dotfiles -d dist -b gh-pages"
```
If you ever see `-e gh-pages` (or `-e` with any branch-sounding value)
anywhere, that's the old bug — use `-b gh-pages` and drop `-e`.

### Standard deploy procedure

```bash
cd /home/user/stitch-pro
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22
npm install --no-audit --no-fund
rm -rf dist && npx expo export -p web

TOKEN=$(python3 -c "import json; print(json.load(open('/home/user/.stitchpro-deploy.json'))['github_token'])")
REPO_URL=$(python3 -c "import json; print(json.load(open('/home/user/.stitchpro-deploy.json'))['repos']['stitch-pro']['url'])")
AUTHED_URL=$(echo "$REPO_URL" | sed -E "s#https://#https://x-access-token:${TOKEN}@#")
rm -rf node_modules/.cache/gh-pages
npx gh-pages --nojekyll --dotfiles -d /home/user/stitch-pro/dist -b gh-pages -r "$AUTHED_URL"
```

### Verifying a deploy actually worked

1. Compare the `gh-pages` branch's `index.html` JS entry hash (via GitHub's
   API, not `raw.githubusercontent.com`) against the fresh local
   `dist/index.html`'s hash — see the `curl .../contents/index.html`
   snippet in earlier revisions of this file, still valid.
2. Load the **live** URL with a real headless browser (Playwright) and
   click through a real flow. Hash-matching alone has been proven
   insufficient once already in this project's history.
3. Give the user a cache-busting link
   (`https://useeman32-design.github.io/stitch-pro/?nocache=12345`).

### Local preview before deploying (recommended)

The app uses a GH-Pages sub-path base URL (`app.json` →
`expo.experiments.baseUrl = "/stitch-pro"`). To preview locally:
```bash
mkdir -p /tmp/pages_root/stitch-pro && cp -r dist/* /tmp/pages_root/stitch-pro/
python3 -m http.server 8090 --directory /tmp/pages_root   # use start_process, not bare `&`-backgrounded bash
# browse http://localhost:8090/stitch-pro/
```
**Known limitation of this local preview method (not a real bug, just a
testing-harness quirk):** `expo export -p web`'s static `.html` files per
route (e.g. `dist/designs.html`) only resolve correctly when reached via
**client-side navigation** from a loaded page (clicking a nav link/button).
Loading one of those `.html` files **directly** (a fresh full-page
`page.goto()`, or a raw browser `reload()` while sitting on an extensionless
client-routed URL like `/designs`) renders an "Unmatched Route" page
locally, because `python3 -m http.server` has no SPA-style fallback/rewrite
rule. The real GitHub Pages deployment may or may not have the same
limitation for *direct* deep links (not independently verified this
session) — but normal usage (load the root, then click around) always
works correctly both locally and live. **When testing "does X persist
across a reload" locally, reload/re-navigate via the ROOT entry + UI clicks,
not a raw `page.goto()` to a non-root `.html` file.**

---

## 5. Known pitfalls / lessons already learned — don't repeat them

- Don't trust HTTP header/hash comparisons alone as proof a deploy is
  correct — always do a live functional browser check too (§4).
- `pointerEvents` must be a React Native component **prop**, not nested in
  `style`, for `'box-none'`/`'box-only'` semantics to work on web.
- `overflow:'hidden'` on a rounded glassy container clips any absolutely
  positioned child that intentionally pokes outside its bounds.
- A `useRef` mutation does not trigger a re-render — use `useState` if a
  ref's value should affect conditional JSX.
- `react-native-reanimated` and `expo-blur` are already installed and
  working (including on the static web export).
- cPanel "Setup Python App" (Phusion Passenger/WSGI) is confirmed present
  on the user's hosting plan — backend targets Flask + WSGI deployment.
  **Nothing has been deployed to cPanel yet** — the agent has no cPanel
  credentials/access; the backend has only ever run in-sandbox
  (`python3 api/app.py`, binds `0.0.0.0:5050`). `DEFAULT_BACKEND_URL` in
  `src/services/digitizing/backendClient.ts` stays empty (disabled) in
  production until that changes.
- **Color quantization can over- or under-split colors** in
  `digitizer/segmentation/color_quantize.py`: the catastrophic
  "everything collapses into one muddy color" bug (background/anti-aliased
  halo pixels stealing the whole MEDIANCUT palette) is **fixed** (backend
  commit `6e11c02`). A milder, *not* fixed, inherent-to-simple-median-cut
  issue remains: when two real foreground colors have very imbalanced
  pixel counts and `max_colors` is set lower than the true color count, the
  smaller region can still blend into a neighboring bucket rather than get
  its own slot. A perceptual/weighted or k-means quantizer would improve
  this further; flagged, not actioned.
- **The local-HEAD-behind-origin git drift described in §3 is not
  hypothetical — it recurred this same session**, immediately after
  fixing the Simulator bug above: `git status` suddenly showed ~25 files
  as new/modified/deleted relative to local HEAD, even though all of that
  work had already been committed and pushed hours earlier. `git log` on
  local HEAD showed a commit from *several sessions* earlier
  (`6b0fdf6`), while `git fetch origin main` + `git log origin/main`
  correctly showed the real, current history (`a2f192b`, with everything
  through Designs/Jobs/Threads/Machines/Settings persistence already
  on it). The actual files on disk were current (they matched
  `a2f192b` + one genuinely new uncommitted fix) — only git's own HEAD
  pointer/object graph had reverted, presumably a sandbox snapshot-restore
  artifact. **Recovery procedure that worked and is safe to repeat:**
  (1) `git diff origin/main --stat` to see the *true* diff between the
  working tree and the real remote (ignore `git status`'s comparison
  against the stale local HEAD entirely) — this cleanly isolated the one
  real new file from the ~25 false positives; (2) back up that one
  genuinely-new/changed file's content (`cp` to `/tmp`); (3)
  `git reset --hard origin/main` to snap local history back to truth;
  (4) copy the backed-up file back over the now-correct working tree;
  (5) confirm `git diff origin/main --stat` now shows only that one
  real file, commit, push as normal. **Never `git reset --hard` without
  first confirming via `git diff origin/main --stat` (not `git status`)
  exactly which files would actually be reverted** — the two can disagree
  dramatically when local HEAD itself is stale.
- **Shell commit messages containing backticks break `git commit -m`** —
  see §2 item 5. Always use `git commit -F <tmpfile>` for anything with
  backticks, code spans, or other shell-special characters.
- **This project has no Jest/RN test environment configured anywhere** —
  frontend verification uses `npx tsc --noEmit`, `npx expo export -p web`,
  and (for pure, dependency-free logic modules) small standalone Node
  scripts in `scripts/test-merge-*.mjs` that transpile a single `.ts` file
  with the `typescript` package and run plain `node:assert` checks. This
  pattern is established now (5 such scripts, 27 passing tests) — keep
  using it for any new pure logic rather than introducing a full Jest setup
  unless the user asks for one.
- **RN-web (at least this app's build) appears to render some screens'
  text content more than once in the DOM** (observed via Playwright:
  `page.locator("text=...")` sometimes returns 2-4 matches for what's
  visually a single on-screen element, with only one match having a real
  bounding box). Root cause not fully diagnosed (not `useResponsive`'s
  `useWindowDimensions` branching, which is a single conditional render —
  possibly `numberOfLines`-truncated `Text` rendering both a visible and an
  offscreen measurement copy under react-native-web, or some router
  prefetch/duplication behavior). **When writing Playwright assertions
  against this app, filter to elements with a non-null `bounding_box()`
  before counting/asserting** — see `addCreatedDesign`-related tests run
  this session for the pattern. Not something to "fix" — just a testing
  gotcha.

---

## 6. Frontend (`stitch-pro`) — structure & status

- Expo **SDK 58** (upgraded from 57 this cycle — `3d7727a`), Expo Router,
  TypeScript, React Native Web. `AGENTS.md` in repo root has general Expo
  conventions.
- **Bottom nav (desktop sidebar / mobile floating pill): done, deployed,
  bugs fixed** (`bde70f8`, `c3e416a`, `3605e15`). Not revisited this
  session — no new reports of it being broken; treat as stable unless the
  user says otherwise.
- **Frontend ↔ backend integration: done.** `backendClient.ts` sends
  stitch-point streams to the backend's `/api/design/points-to-file` for
  real multi-format (DST/PES/JEF/VP3/EXP) export, with an 8s-timeout
  fail-soft fallback to the client-side DST-only writer if the backend is
  unreachable (which it always is in production right now — no persistent
  host exists yet). `analyzeImageViaBackend` (used by
  `useStitchPreview.ts`) calls the newer `/api/design/image-to-points`
  JSON endpoint for live stitch *preview* rendering (as opposed to file
  export) — this is what powers the Simulator's embossed stitch render on
  **both web and native**, not just web; native has no equivalent
  client-side fallback (impossible — `stitchEngine.ts` hard-requires a DOM
  canvas), so native with no reachable backend correctly shows a "couldn't
  reach the digitizing backend" message instead of crashing or showing a
  stale/fake preview. This was the cross-platform stitch-generation gap
  flagged in earlier sessions — **it's resolved**, verified by code
  inspection of `useStitchPreview.ts` this session (not independently
  re-tested on a real native device/simulator, since this sandbox has no
  native runtime — only web has been live-tested).
- **Realistic 2D embossed stitch preview: done** (`4085ff2`).
  `EmbossedStitchCanvas.tsx` does a three-layer render (shadow-offset pass
  → gradient-shaded thread body → sheen highlight) from real stitch points,
  via `react-native-svg` (Skia was considered and rejected). A sample
  reconstruction is in `sample-output/simulator_embossed_preview_mockup.png`
  (built standalone outside the app for a "show me a screenshot" ad-hoc
  request — not a literal screen capture, but built from the real backend
  + real rendering code).
- **Real local persistence: done, this session** (`3e57a12`, `7ade61a`,
  `066991c`). This was the single biggest remaining gap in the whole app:
  **every** service module (`designs`, `jobs`, `threads`, `machines`,
  `auth`/settings) used to keep its data in a plain in-memory array or
  ignore mutations entirely, so *everything* a user did — digitize/save a
  design, favorite something, delete something, use a template, save from
  Manual Editor, add/advance a job, add a thread, register/toggle/delete a
  machine, edit the Settings form (name/email/default format/hoop/unit/
  notifications) — silently reverted on the next page refresh or app
  relaunch. Settings' "Save Changes" was the most egregious case: it was a
  pure 400ms `setTimeout` + success toast with **zero** actual persistence.
  All of this now goes through `@react-native-async-storage/async-storage`
  (already a dependency, works on web via localStorage/IndexedDB and on
  native via its native KV store) via a thin wrapper,
  `src/services/storage/localStore.ts`. Architecture, per service:
  - A hardcoded **seed** array/object stays as-is in source (can't safely
    persist a bundler `require()` asset id across rebuilds — ids aren't
    stable).
  - A pure, dependency-free `mergeX.ts` module per service
    (`designs/mergeDesigns.ts`, `jobs/mergeJobs.ts`,
    `threads/mergeThreads.ts`, `machines/mergeMachines.ts`,
    `auth/mergeProfile.ts`) layers persisted created-items / overrides /
    delete-tombstones on top of the seed. Kept free of React
    Native/AsyncStorage imports specifically so they're unit-testable with
    plain Node (see §5's testing note) — `scripts/test-merge-*.mjs`, one per
    module, 27 tests total, all passing.
  - `designsService.create()` normalizes any thumbnail to a durable `{uri}`
    form via `Image.resolveAssetSource()` before persisting (handles the
    "use this Template" flow, which passes a numeric `require()` id) —
    this was a real latent bug caught and fixed *before* it shipped, not
    an incident.
  - `src/utils/thumbnail.ts` (+ new `expo-image-manipulator` dependency,
    version-matched to SDK 58) downscales/compresses a freshly picked
    Auto-Digitize artwork image into a small `data:` URI before saving,
    since the image picker's own `uri` (a web `blob:` URL or native
    cache-dir path) doesn't survive a reload/relaunch.
  - `designs.tsx`'s "Delete" button now actually calls
    `designsService.remove()` (it used to only mutate local component
    state, so a refresh brought the "deleted" design right back).
  - Verified end-to-end this session with real headless-browser
    (Playwright) sessions against a static web export: created a design via
    Manual Editor → reload → still there; toggled a favorite → reload →
    still favorited; deleted a design → reload → still deleted; edited
    Settings' name + default export format → saved → reload → both
    persisted. All confirmed via real `window.localStorage` inspection, not
    just visual appearance.
  - **Not yet extended to**: Templates (read-only catalog, no mutation
    needed), Quality Check / Cost Calculator / Analytics (pure
    read/compute screens, nothing to persist), Learn (static content).
    These were checked this session and found to have no fake-persistence
    gap — leave them alone unless the user reports otherwise.
- **Real bug found and fixed (same day, after the user tested the live
  site): Simulator rendered every design at ~1/10th size, stuck in the
  top-left corner of the stage** (commit `036f8b3`). Root cause:
  `EmbossedStitchCanvas.tsx`'s SVG `viewBox` is sized in "preview units"
  (mm × `PX_PER_MM` = 10, e.g. an 80mm design gets `viewBox="0 0 800 800"`)
  for stroke/gradient resolution, but the segment coordinates it receives
  from `stitchPreview.ts` (`gridSegmentsToMm`/`pointsToMmSegments`) are in
  real mm units (0..80 for that same design) — they were drawn directly
  against the 10×-larger viewBox with no scaling, so every design rendered
  correctly shaped but at exactly 1/10th size. Confirmed via live-site DOM
  inspection (viewBox was right, but every `<line>`'s x/y only spanned
  0..~79 instead of 0..~790). **Fixed** by scaling segment coordinates by
  `PX_PER_MM` once, right before rendering (new `scaledDrawList`); the
  needle-position percentage calculation already used the correct raw-mm
  values and didn't need touching. Verified with a real headless-browser
  stitch-out against the live production URL, not just locally.
  **If a similar "shape is right but size/position is off" visual bug
  shows up anywhere else that uses `MmSegment`s or feeds into an SVG
  viewBox, check for exactly this kind of unit mismatch between "real mm"
  and "preview-scaled" coordinate spaces before assuming it's a CSS/layout
  issue.**
- Design tokens: `src/theme/tokens.ts` — always import from there.

---

## 7. Backend (`stitchpro-backend`) — structure & status

- Python 3.13, Flask (`api/app.py`), `digitizer/model.py` (the only
  internal data model — nothing outside `formats/dst/writer.py` should
  touch raw pyembroidery `EmbPattern`/DST bytes directly), `formats/`
  (read/write layer), `passenger_wsgi.py` (cPanel entry point).
- `requirements.txt`: `flask`, `pyembroidery`, `pillow`, `shapely`. No
  OpenCV/scikit-image anywhere (deliberate, for shared-hosting constraints
  — see `docs/embroidery-engine-research.md`).
- **License stance (unchanged)**: `pyembroidery` (MIT) used directly;
  Ink/Stitch and PEmbroider (GPL/ACSL) are reference-reading only, never
  copied — PEmbroider's Anti-Capitalist license explicitly forbids
  commercial embroidery-digitizing software, stay far away from its code.
- **All 5 planned engine milestones are done**: running stitch (`082996b`),
  satin (`1ddc364`), fill/tatami (`c945e9a`), combined routing (`7df5cf6`),
  real server-side image digitizing / PNG → segmentation → objects
  (`b6331e1`). Plus a quality pass (fill holes, underlay, arc-length satin
  curves — `b76ccf3`), the cross-platform JSON points-preview endpoint
  (`e615e3e`), an earlier narrower color-quantization fix (`6e11c02`, now
  superseded — see below), and a substantial follow-up pass (`6ab041b`,
  latest) covering real-photo background removal, curve smoothing,
  cross-stitch, and solid-fill fixes (see next bullet). **139/139 tests
  passing** as of `6ab041b`.
- **API surface (current, real)**:
  - `GET /api/health`, `GET /api/formats`.
  - `POST /api/design/line-to-dst` — legacy Milestone-1 endpoint, unused by
    the frontend, kept for backward compat.
  - `POST /api/design/points-to-file` — compiles an already-computed
    `DstPoint[]`-style stream into a real DST/PES/JEF/VP3/EXP file. This is
    what the frontend's export/download flow actually calls.
  - `POST /api/design/image-to-file` — Milestone 5: real image → digitize →
    file, for server-side digitizing of a raw uploaded image. Now also
    accepts `stitch_style` (`"fill"` default, or `"cross"` for a cross-
    stitch grid), `angle_deg`, and `smooth_curves` (bool, default true);
    `density_mm` is now optional and defaults to a style-appropriate value
    (0.4mm fill rows, 1.8mm cross-stitch cells) if omitted.
  - `POST /api/design/image-to-points` — same digitizing pipeline as
    image-to-file (same new fields above), but returns the JSON
    point-stream contract instead of a binary file, for client-side
    *preview* rendering (web + native alike). This is what
    `useStitchPreview.ts` calls.
  - CORS wide open (`*`) — tighten once there's real auth/session state.
- **Fixed in `6ab041b` (latest, addresses direct user feedback from local
  testing of the Google-logo case)**:
  - **Real-photo background/material removal**: `digitizer/segmentation/
    background_removal.py` (new) replaces the old single-global-background-
    color-distance test with a three-pass approach: (1) a border-connected
    flood fill that's tolerant of *local* gradual color change (shirt
    lighting/shading across a real photo), (2) a tunnel-rejection pass that
    catches and reverses cases where that flood fill "tunneled" through a
    multi-pixel anti-aliased blend band into a solid differently-colored
    foreground region (found via real testing — a blue badge on a gradient
    background was getting incorrectly erased as background), (3) an
    enclosed-hole pass (unchanged behavior from before — a letter "O"'s
    counter still correctly becomes a hole, not its own foreground region).
  - **Curve smoothing**: `digitizer/geometry/smoothing.py` (new) — adaptive,
    corner-preserving Chaikin smoothing wired into `digitizer/segmentation/
    polygons.py` after the existing Douglas-Peucker simplify. Shallow-turn
    vertices (an approximated curve) get corner-cut; sharp, intentional
    corners are left untouched.
  - **Cross-stitch**: `digitizer/stitches/cross/generator.py` (new),
    `ObjectType.CROSS_STITCH`, dispatch wiring, and `pipeline.py`'s new
    `stitch_style` parameter (`"fill"` | `"cross"`, applies to the whole
    design — per-region auto-classification is a future follow-up, not
    implemented).
  - **Solid-fill fix** (the literal "fill isn't fully solid, generates
    lines that don't fill it" complaint): two root causes found and fixed.
    (a) `color_quantize.py`'s MEDIANCUT sometimes allocated a second,
    near-identical palette entry for a solid color's anti-aliased edge
    pixels instead of folding them into the same bucket — fragmenting one
    clean region into two differently-"colored" (but visually identical)
    objects with a seam between them; fixed with a new
    `_merge_near_duplicate_colors` dedup pass. (b) `polygons.py`'s
    `label_grid_to_ring_groups` gained a `min_bbox_mm` filter (checked on
    the *shorter* bounding-box side, not area) to discard thin, hair-width
    slivers that survive the existing `min_area_px` filter but were never a
    real stitchable design feature.
  - **Verified end-to-end** against a real Google "G" logo PNG (both as a
    plain transparent PNG and composited onto a synthetic noisy/gradient
    "shirt" background): both now produce exactly 4 clean single-object
    regions matching the logo's 4 real colors, with no background bleed-
    through and no fragmentation.
  - 41 new tests across `test_background_removal.py`, `test_smoothing.py`,
    `test_cross_stitch.py`, `test_api.py` (new — first direct Flask-
    test-client coverage of `api/app.py`), plus additions to
    `test_pipeline.py`/`test_segmentation.py`.
  - **Not yet done from this same feature request**: (1) frontend wiring —
    no UI yet for selecting `stitch_style`/`angle_deg`/`smooth_curves`
    (Auto-Digitize settings screen not touched this session); (2) the
    Simulator's "real 3D threaded look" ask (point 3 of the user's request)
    — still just the existing embossed-canvas look, not yet revisited for
    a more realistic raised-thread render.
- **Hosting**: cPanel "Setup Python App" (Passenger/WSGI) confirmed
  available on the user's plan, but **nothing has been deployed there
  yet** — the agent has no cPanel credentials. The backend has only ever
  run in-sandbox. This is still the single biggest "real" gap in the whole
  project: until a backend is actually hosted somewhere persistent, every
  real-digitizing/multi-format-export/embossed-preview feature only works
  when the frontend is pointed at a temporarily-running in-sandbox backend
  via the `localStorage.setItem('stitchpro_backend_url', 'http://host:port')`
  override — it is NOT live for real production users on the GitHub Pages
  site today.

---

## 8. Suggested next steps (pick up here)

1. **Frontend wiring for the new backend capabilities (`6ab041b`)** — no UI
   yet exposes `stitch_style` ("fill"/"cross"), `angle_deg`, or
   `smooth_curves` to the user. Likely the Auto-Digitize settings screen
   (not yet located/read this session) needs a stitch-style picker at
   minimum; wire it through `backendClient.ts`'s request params.
2. **Simulator "real 3D threaded" look** — still outstanding from the same
   user request that drove `6ab041b`. The user wants the preview to look
   like actual raised thread/stitching, "not just lines", building further
   on the already-shipped embossed-canvas work
   (`EmbossedStitchCanvas.tsx`/`stitchPreview.ts`, not read/touched this
   session — read those first before changing anything).
3. **Deploy `stitchpro-backend` somewhere persistent** (ideally the user's
   cPanel hosting) and update `DEFAULT_BACKEND_URL` in
   `src/services/digitizing/backendClient.ts`, then rebuild + redeploy the
   frontend. This is still the single highest-leverage remaining gap — it's
   the one thing that turns "real digitizing works when I manually point
   the app at a sandbox" into "real digitizing works for actual users".
   Needs a human with cPanel access; ask the user to walk through their
   panel, or for credentials, when this is picked up.
4. If the user reports the bottom nav or embossed preview rendering is
   broken on a real device, get a screenshot + exact browser/device before
   guessing at CSS/layout fixes — see §5's lessons.
5. Local Windows reproduction of the dev environment was previously
   paused, blocked by an unresolved Expo Go sign-in error (not revisited
   this session — may still be an open thread with the user).
6. Per-region automatic stitch-style classification (e.g. auto-detecting a
   thin/elongated region and digitizing it as SATIN, or auto-choosing
   cross-stitch only for regions that look pixelated) is a known, not-yet-
   implemented follow-up — `stitch_style` today applies to the whole design
   at once, chosen by the caller.
7. Persistence (§6) currently only covers this device/browser's local
   storage — there is still no real backend database or multi-device sync.
   If the user wants designs/jobs to follow them across devices or wants
   a real login system, that's a genuinely new, large feature (real
   backend auth + a database), not a quick follow-up — confirm scope with
   the user before starting it rather than assuming.
8. Always re-run the full verification loop before calling anything done:
   `cd stitchpro-backend && venv/bin/python3 -m pytest -q` (expect
   139/139+), `cd stitch-pro && npx tsc --noEmit` (expect clean), `node
   scripts/test-merge-*.mjs` for each (expect all green), `npx expo export
   -p web` (expect no errors), then a live-browser smoke check per §4.
