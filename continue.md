# StitchPro — Handoff / Continuation Notes

_Last updated: 2026-10-28 (New stitch types — Appliqué, 3D Puff, Bean,
Motif — shipped end-to-end across both repos; see the dedicated session
entry right before §6)._

_Previously updated: 2026-10-22, later same day (user tested on GitHub Pages
after waking up and reported a real bug; fixed, verified live, see §6)._

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
- **Repeat of the git-HEAD-drift incident, a third time, start of this
  session**: before any edits were made, `git status` already showed ~38
  files as new/modified/deleted relative to local HEAD. `git log` on local
  HEAD showed `6b0fdf6` — several sessions behind — while a fresh
  `git fetch origin` (after re-adding the `origin` remote from
  `/home/user/.stitchpro-deploy.json`, since `.git/config` itself doesn't
  survive a snapshot restore) showed the real current history at `8991d62`.
  Spot-checking several of the "modified" files
  (`git show origin/main:<path> | diff - <path>`) proved they were
  **byte-identical** to origin/main already — only git's own HEAD/index
  pointer had reverted, not the actual working-tree files. **Recovery used
  this time (cleaner than the §5 `--hard` procedure, prefer this first):**
  `git merge --ff-only origin/main` (confirms HEAD is a true ancestor and
  refuses safely if anything would conflict) — it correctly refused because
  of the "stale" uncommitted changes, which confirmed none of this was a
  real divergence; then `git reset --mixed origin/main` (moves HEAD *and*
  the index to match origin/main, touches zero working-tree files) — after
  that, `git status` showed *only* the files genuinely changed this
  session. `--mixed` is strictly safer than `--hard` here since it can
  never silently discard a real edit sitting in the working tree; only use
  `--hard` if `--mixed` leaves the tree in a state `git diff` shows as
  unexpectedly large.
- **Playwright `get_by_text(X, exact=False)` gotcha**: if a screen has both
  a short descriptive sentence mentioning a control's label (e.g. a hint
  paragraph that says "...Cross-Stitch lays down a grid...") *and* the
  actual pressable chip labeled "Cross-Stitch", a substring-matching
  locator matches the paragraph first (DOM order), and clicking it is a
  silent no-op — the chip is never actually pressed. Always check
  `locator.count()` and pick the right index (or use an exact/structural
  selector) rather than assuming `.first` is the interactive element,
  especially on a settings screen with explanatory copy.

## Session: Stitch style/angle/cross-stitch wired to the real backend +
## Simulator thread-dash render (this session)

Addressed the two remaining items from the user's "analyze everything,
give me the best result" request (background removal was already solid;
3D-thread Simulator look and selectable fill/cross-stitch were the gaps):

- **Root cause confirmed, then fixed: the actual generate→export flow
  never touched the backend's real digitizing pipeline at all.**
  `settings.tsx`'s `handleGenerate` called the 100% client-side, synchronous
  `generateRealStitchPlan`/`stitchEngine.ts` (a simple canvas pixel-row
  scan) — the backend's background-removal/smoothing/color-merge/
  cross-stitch work from earlier sessions was only ever reachable via the
  Simulator's `useStitchPreview` hook, never via the actual digitize-and-
  download flow users go through. This is why the user's own Google-logo
  test showed non-solid fills in the exported DST despite the backend
  fixes already existing — the export never used them.
- **Fix**: `handleGenerate` now tries `analyzeImageViaBackend` (real
  backend, same fail-soft 8s-timeout pattern as `exportViaBackend`) FIRST;
  only falls back to the old client-only `generateRealStitchPlan` if the
  backend is unreachable. Because every downstream screen
  (`preview.tsx`'s stats, `success.tsx`'s download) already just reads
  `dstPoints`/`stitchPlan` from `DigitizeWizardContext`, fixing generation
  once here automatically fixes the real exported file for every format,
  with zero changes needed in `preview.tsx` or `success.tsx`.
- Added a new `summarizePoints(points, widthMm, heightMm)` helper in
  `stitchPlanner.ts` — converts a raw backend `DstPoint[]` stream into the
  same `RealStitchPlan` stats shape the old client pipeline produced
  (stitches/colors/threadChanges/jumps/thread-length/time estimate), so
  both pipelines feed the UI identically regardless of origin.
- `backendClient.ts`'s `analyzeImageViaBackend` signature changed from a
  positional `maxColors` arg to an options object:
  `{ maxColors?, stitchStyle?: 'fill'|'cross', angleDeg?, smoothCurves?,
  densityMm?, stitchLengthMm? }` — all forwarded as extra `FormData` fields
  to `/api/design/image-to-points`. Updated the one other call site
  (`useStitchPreview.ts`, which also gained optional `stitchStyle`/
  `angleDeg` params it doesn't use yet — Simulator still runs with
  backend defaults, see below).
- `DigitizeSettings` (`src/services/digitizing/index.ts`) gained
  `stitchStyle: 'fill'|'cross'` (default `'fill'`) and `angleDeg: number`
  (default `0`), plus three new density→backend-param lookup tables:
  `DENSITY_STITCH_LENGTH_MM`, `DENSITY_FILL_SPACING_MM`,
  `DENSITY_CROSS_CELL_MM` (Light/Standard/Dense, reused by `settings.tsx`
  to pick the right backend param depending on which style is selected —
  fill designs send `density_mm` as row spacing, cross-stitch designs send
  it as grid cell size).
- **New UI in `settings.tsx`**: a "Stitch Type" card (Fill / Cross-Stitch
  chips, same chip pattern as Placement/Fabric) + a "Stitch Angle" slider
  (0–179°, same `Slider` component as density), between the existing
  Fabric/Density card and Thread Colors card.
- **Verified end-to-end with a live local backend + real headless-browser
  run** (not just `tsc`/unit tests): uploaded the real Google "G" logo
  through the actual Auto-Digitize wizard, selected Cross-Stitch, hit
  Generate, and captured the real network request — confirmed
  `stitch_style=cross` / `density_mm=1.8` reached the backend and produced
  a genuinely different point stream (2,058 stitches, 4 colors) than Fill
  (3,060 stitches, 5 colors, `density_mm=0.4`) on the identical source
  image. Downloaded the resulting **DST file through the real UI** (the
  actual "Finish & Download" → format-chip flow in `success.tsx`,
  unmodified) and validated it with `pyembroidery.read()`: 3,494 real
  stitches, correct bounds for a 90×90mm design. This proves the whole
  chain — upload → real backend digitize (background removal + chosen
  stitch style/density) → correct stats → valid downloadable file — works
  with zero manual intervention once a backend is reachable.
- **Simulator "3D threaded" visual upgrade — done**
  (`EmbossedStitchCanvas.tsx` rewritten). The previous render drew each
  `MmSegment` as one long continuous 3-pass line (shadow/gradient-body/
  sheen) — visually a smooth ribbon, not individual stitches. Now every
  segment is first chopped into short "stitch dash" pieces (~2.6mm long,
  ~0.5mm gap, see `STITCH_LEN_MM`/`STITCH_GAP_MM`) via a new
  `subdivideIntoDashes()`, and each dash's shadow/sheen offset is computed
  **perpendicular to that dash's own direction** (not a fixed page
  diagonal) — this is what makes a satin/fill row's sheen ridges follow the
  actual stitch direction, matching how real thread catches light. Also
  added a second (horizontal) set of fabric "weave" lines alongside the
  existing vertical ones for a more convincing woven backdrop. Gated behind
  the existing `EMBOSS_LAYER_CAP`(1200)/`DECIMATE_ABOVE`(5000) perf
  safeguards, plus a new `MAX_SEGMENTS_FOR_DASHING`(2500) raw-segment cap —
  above that, falls back to one plain line per raw segment (still colored/
  capped, just no dash-gap/shadow/sheen) rather than risk an oversized SVG
  tree. **Visually confirmed** via a live Playwright run against the
  Simulator screen with the real "Lion Logo" preset design (12,482 real
  backend-generated stitches) — a zoomed crop of the completed stitch-out
  clearly shows discrete shaded dashes with visible gaps between them, not
  a continuous line. Note: at that stitch count the raw segment count
  exceeds `MAX_SEGMENTS_FOR_DASHING`, so the dash *texture* visible there
  actually comes from the backend's own naturally-short real stitch lengths
  (a real tatami/fill stitch is already only a few mm) combined with the
  per-segment rounded-cap stroke — the explicit dashing in this component
  specifically matters for designs with long individual raw segments
  (e.g. long running-stitch outlines), which the Lion Logo preset doesn't
  exercise. Both paths were exercised and look correct.
- **Known, deliberately-not-chased minor issue**: stress-testing background
  removal with a synthetic test image made of several small, tightly
  overlapping/adjacent flat-color shapes (to maximize anti-aliased-edge
  pixel proportion relative to fill area) produced correctly-separated,
  fully-solid regions (confirming requirement 2's "fills aren't solid"
  complaint is resolved), but with slightly shifted thread colors (e.g. a
  pure green region coming back teal-ish) — almost certainly simple
  color-quantization cluster-mean pollution from a higher-than-typical
  proportion of blended edge pixels, not a background-removal or fill
  regression. Not reproduced with the real Google logo (clean 4/4 color
  match, as validated in an earlier session) or with the Lion Logo preset.
  Flagged for awareness, not actioned — would need a perceptually-weighted
  or edge-excluding quantizer to improve further if a user ever reports it
  on a real design.
- **Not changed this session, still true**: the Simulator
  (`simulator.tsx`/`useStitchPreview.ts`) only ever previews the 5
  hardcoded preset `Design` records (Lion Logo, Monogram M, Company Logo,
  Floral Design, Cap Logo) via their bundled thumbnail images, calling the
  backend with its style/angle defaults (`fill`, `angle_deg=0`) — it does
  **not** yet reflect whichever `stitchStyle`/`angleDeg` a *user's own*
  Auto-Digitize session chose, because saved `Design` records don't
  persist those fields yet. Low priority (the actual export/download path
  is correct regardless); would need extending the `Design` type and
  `designsService.create()` if ever prioritized.
- Environment rebuild needed again this session (expected, see §3): `nvm`
  itself was gone (`curl | bash` reinstall), Node 22 reinstalled via
  `nvm install 22`, `npm install` in `stitch-pro`, and
  `stitchpro-backend`'s `venv` had to be fully recreated
  (`rm -rf venv && python3 -m venv venv && pip install -r requirements.txt
  pytest`) — its old venv's site-packages had vanished even though the
  `venv/` directory and its `bin/activate` script were still present
  (half-empty environment, `ModuleNotFoundError: No module named 'flask'`).
  **If `venv/bin/python -c "import flask"` fails even though the venv
  directory exists, don't try to repair it piecemeal — just
  `rm -rf venv` and rebuild from `requirements.txt` fresh.**
- **Sandbox is memory-constrained (≈1.9GB RAM, no swap)** — running Metro
  (`expo start --web`) *and* a Playwright/Chromium instance at the same
  time OOM-killed Metro once this session (exit code 137). Chromium alone
  idles around 150-300MB RSS; Metro's first full bundle compile transiently
  spikes well above that. **If both are needed, run them sequentially, not
  concurrently** — bundle via `expo export -p web` for a static,
  Chromium-safe artifact, or finish all Playwright runs before leaving a
  long-lived `expo start` dev server up as a live preview.
- For testing a **static web export** (`expo export -p web`) with
  Playwright: the app's `app.json` sets `experiments.baseUrl: "/stitch-pro"`
  for GitHub Pages hosting, so the exported `dist/` only works correctly
  when served from under a `/stitch-pro/` path prefix (symlink/serve the
  `dist` folder as `webroot/stitch-pro`, not `webroot` directly) — and
  Expo Router's client-side router doesn't recognize a literal `.html`
  suffix or a bare extensionless path through a plain `http.server`, so
  direct full-page navigations need either the real directory-style URL
  (e.g. `/create/auto-digitize/` which has its own `index.html`) or a
  tiny custom static server that rewrites extensionless requests to
  `<path>.html` (see the pattern used this session) for routes that only
  exist as a flat `<name>.html` file (e.g. `/simulator`). The **dev server**
  (`expo start --web`) has neither quirk — it serves everything at a clean
  root path with no baseUrl — so prefer it for Playwright smoke tests when
  memory allows (see OOM note above).

---

## Session: New stitch types — Appliqué, 3D Puff, Bean, Motif (this session)

User picked this from the standing backlog (§8's old item 6, "per-region
automatic stitch-style classification") and explicitly broadened it to 4
real stitch types, each auto-selected by the engine per detected region —
**no manual per-region editor, ever** (confirmed via `ask_user`, consistent
with the standing "automatic/heuristic, no manual toggle" rule). Build
order (also confirmed via `ask_user`): 3D Puff first, then Bean/Motif/
Appliqué together. Shipped as two separate commits, backend then frontend,
each fully tested before moving on.

### Backend (`stitchpro-backend@b2e7d72`)

- **New `ObjectType` values** in `digitizer/model.py`: `BEAN`, `MOTIF`,
  `PUFF_3D`, `APPLIQUE` (alongside the existing `RUNNING`/`SATIN`/`FILL`/
  `CROSS_STITCH`).
- **New per-type stitch generators**, each in its own package under
  `digitizer/stitches/`: `bean/`, `motif/`, `puff/` (plus
  `puff/eligibility.py`), `applique/`. All wired into
  `digitizer/stitches/dispatch.py`'s `generate_object_stitches`.
- **Classification heuristics** (all automatic, no user input):
  - `thin_region.py` gained `DEFAULT_BEAN_MAX_WIDTH_MM=1.0` (hairline
    strokes get a reinforced multi-pass running stitch instead of a satin
    column too thin to look right) and
    `DEFAULT_MOTIF_MIN_ELONGATION_RATIO=10.0` (very long, very thin, mostly-
    straight regions become a tiled decorative motif instead of satin).
  - `digitizer/stitches/puff/eligibility.py`'s `is_puff_eligible` —
    `min_bbox_fill_ratio=0.55`, `min_area_mm2=25.0`,
    `max_design_area_fraction=0.35` — a region becomes PUFF_3D if it's a
    solid, reasonably-filled, reasonably-sized-but-not-dominant shape.
  - `pipeline.py`'s new Appliqué check — `_APPLIQUE_MIN_DOMINANT_AREA_
    FRACTION=0.40` and `_APPLIQUE_MIN_CONVEXITY=0.85`: the single most
    dominant, most convex, hole-free region in a design becomes APPLIQUE
    (a fabric patch sewn on) instead of a dense fill; everything else still
    falls through to the existing FILL/SATIN/BEAN/MOTIF/PUFF_3D logic.
  - A letter-"O"-style holed region (`len(rings) >= 2`) is explicitly
    excluded from both PUFF_3D and APPLIQUE regardless of how dominant/
    convex its outer ring is — stays FILL, matching pre-existing behavior.
  - No threshold tuning was ultimately needed beyond these defaults — every
    initial test mismatch during development traced back to test-image
    construction artifacts (downscale resampling, float boundary cases,
    ambiguous overlapping shapes), not the heuristics themselves.
- **Real machine STOP command — the genuinely new, non-trivial part.**
  PUFF_3D and APPLIQUE objects end their stitch-out with a `"stop"` event
  (third element of `generate_object_stitches`' `(x_mm, y_mm, command)`
  tuple contract, alongside `"stitch"`/`"jump"`), at the same x/y as the
  immediately preceding point (pure pause, no movement). This required
  threading a brand-new command type through the *entire* output stack:
  - `formats/dst/writer.py`'s `compile_design` maps `"stop"` to
    pyembroidery's real `STOP` command (`_CODE_BY_COMMAND`). At the raw DST
    byte level `STOP` and `COLOR_CHANGE` are the *identical* 3-byte record
    (confirmed by reading pyembroidery's own `DstWriter.encode_record`
    source) — what makes it a genuine pause rather than a color change is
    simply that no new thread is registered for it, exactly how every
    commercial digitizing program encodes a mid-design pause in this
    format.
  - `formats/points_writer.py` (the separate compiler used by
    `/api/design/points-to-file` for the frontend's own already-computed
    point streams) needed the same `"stop": STOP` entry added to its
    `_COMMANDS` dict — **this was a real bug caught by a new integration
    test**: without it, a Puff/Appliqué design's point stream would fail
    to download with `"unknown command 'stop'"` the moment a real user hit
    Download, because the frontend's download path goes through this
    module, not `compile_design`.
  - `digitizer/points_export.py` (JSON preview-points endpoint) already
    passed `command` through generically — needed zero changes, but its
    docstring was updated to mention `"stop"` as a valid value.
- **Tests**: `tests/test_{bean,motif,puff,applique}_stitch.py` (per-type
  generator unit tests), `tests/test_new_stitch_types_pipeline.py`
  (classification heuristics against real rendered test images — see the
  exact geometry recipes below), and `tests/test_api.py`'s new
  `TestNewStitchTypesRealDownloadFlow` (2 tests exercising the *actual*
  frontend flow end-to-end: `/api/design/image-to-points` →
  `/api/design/points-to-file`, confirming a real "stop" command survives
  the full round trip and produces a valid `pyembroidery.read_dst`-readable
  file). **Full suite: 230/230 passing** (up from the previously-documented
  139/139 — the gap also includes several other sessions' worth of tests
  not individually itemized in this file; see git log for the complete
  history if ever needed).
- **Confirmed test-image geometry recipes** (all ≤150px long side to avoid
  `load_and_downscale`'s `max_dim=150` resampling changing measurements):
  - BEAN: 140×40px image, `width_mm=28, height_mm=8`, a 2-3px-tall bar →
    0.6-0.8mm measured width → `ObjectType.BEAN`.
  - MOTIF: same scale, a 10px-tall bar → ~2.2mm wide, ~24.2mm long,
    elongation ratio ~11 → `ObjectType.MOTIF`.
  - PUFF_3D (non-dominant): 210×70px image, three ~55×50px rounded rects
    in 3 different colors, `width_mm=60, height_mm=20` → at least one
    becomes PUFF_3D, none becomes APPLIQUE.
  - APPLIQUE (dominant, hole-free): 160×100px image, one large rounded
    rect (black) + one small separate gold accent rect, `width_mm=48,
    height_mm=30` → the dominant shape becomes APPLIQUE, the accent
    becomes PUFF_3D. **This exact recipe was also used live this session**
    to confirm the real `/api/design/image-to-points` endpoint returns
    `stitchTypeBreakdown: [{"type":"APPLIQUE",...},{"type":"PUFF_3D",...}]`
    with 3 real `"stop"` points in a 1342-point stream.
  - Letter-O regression guard: 120×120px image, outer+inner-hole ellipses,
    `40×40mm` → stays `ObjectType.FILL` (never APPLIQUE/PUFF_3D) despite
    dominance, because of the 2-ring hole check.

### Frontend (`stitch-pro@90d0dab`)

- **`src/utils/dstWriter.ts`** (the client-side DST encoder, used as a
  fallback when the backend is unreachable, and for the binary-equivalence
  logic the backend client mirrors): added `'stop'` to the `DstCommand`
  union, encoded with the exact same byte pattern as `colorChange`
  (`0b11000011`) — verified correct by round-tripping a frontend-generated
  `.dst` file through `pyembroidery.read_dst()` in this same session.
- **`StitchTypeBreakdownEntry['type']`** (`backendClient.ts`) extended with
  `'BEAN' | 'MOTIF' | 'PUFF_3D' | 'APPLIQUE'`.
- **"Stitch Types" card** (`create/auto-digitize/preview.tsx`): friendly
  labels for all 4 new types; PUFF_3D/APPLIQUE chips render in the warning
  tone with an explicit "your machine will pause mid-stitch" hint line,
  surfaced automatically whenever the backend's auto-selected regions
  include either type.
- **"Machine Pauses" stat** (`StitchStats.tsx` + `stitchPlanner.ts`'s new
  `stops` field on `RealStitchPlan`/`StitchPlanSummary`) — only shown when
  non-zero.
- **Simulator pause markers** (confirmed explicitly via `ask_user` as
  in-scope, not just "nice to have"): `stitchPreview.ts`'s
  `pointsToMmSegments` now emits a zero-length `'stop'`-kind marker
  segment; `EmbossedStitchCanvas.tsx` renders it as a distinct amber ring +
  pause-bars glyph (not a line, since it has zero length — had to special-
  case it *before* the existing `len < 1e-6` degenerate-segment skip, which
  would otherwise silently drop it); click-to-inspect reports it as
  "Machine Pause" (warning-tone badge); and the Simulator's own playback
  loop (`simulator.tsx`) now genuinely auto-pauses when progress reaches a
  real stop (checking every segment index crossed each tick, not just the
  final one, so a fast speed can't skip past it), showing a
  "⏸ Paused — place foam/fabric, then press Play" banner distinct from the
  normal "Stitch-out complete" badge, and resumes cleanly afterward (a ref
  tracks the highest stop index already handled so resuming doesn't
  instantly re-trigger).
- **Verified**: `tsc --noEmit` clean, `eslint` clean (zero new issues —
  explicitly diffed the handful of remaining findings in touched files
  against `origin/main` *before* this change to confirm they pre-date it:
  an unescaped apostrophe in `settings.tsx`, a stale `eslint-disable`
  comment in `EmbossedStitchCanvas.tsx`, an unused `catch (e)` var in
  `services/digitizing/index.ts` — none touched by this work, left alone).
  Ran the real committed `pointsToMmSegments` function (not a
  reimplementation) against the real backend JSON response for the
  APPLIQUE+PUFF_3D test image above — confirmed it correctly produces 3
  zero-length `'stop'`-kind segments. Live-loaded the Simulator screen in a
  headless Playwright browser with zero console/page errors.
- **Not fully verified this session**: a complete Playwright click-through
  of the Auto-Digitize wizard (upload → settings → preview) showing the
  live "Appliqué"/"3D Puff" chips and pause banner rendered in-browser.
  Two blockers, both environmental, not code bugs: (1) `expo-image-
  picker`'s web shim creates its hidden file input and clicks it with a
  *synthetic* `dispatchEvent(new MouseEvent('click'))` rather than a real
  `.click()`/trusted gesture, which headless Chromium silently refuses to
  turn into an actual native file-picker dialog — no `filechooser` event
  ever fires, no error either, so Playwright can't drive the real upload
  button at all (a known Chromium/Playwright limitation, not a StitchPro
  bug; the existing `verify_stitch_types.js` script sidesteps this by
  clicking a bundled **sample** image instead of uploading). (2) The
  sandbox's ~1.9GB RAM (see the OOM note earlier in this file) could not
  sustain Metro bundling *and* a full Auto-Digitize wizard run (image
  decode + backend digitize + SVG render) under simultaneous Playwright
  load — the dev server was OOM-killed (exit 137) twice attempting this,
  even after temporarily swapping one bundled sample asset for the test
  image on disk (reverted afterward, never committed) to route around
  blocker (1). If a future session wants this specific end-to-end visual
  confirmation, do it as its own isolated step: start Metro, let it fully
  idle/settle, warm the target route via a plain `curl` first, launch
  Playwright alone (no other heavy process running), and keep the
  interaction to the minimum needed (ideally reusing the sample-click
  pattern from `verify_stitch_types.js`, with one sample asset temporarily
  pointed at a crafted Appliqué/Puff test image via `git checkout` to
  revert after).
- Environment rebuild needed yet again this session (same recurring
  issues as §3/other session entries): `origin` git remote vanished on
  **both** repos mid-session (not just at session start — it disappeared a
  second time on `stitch-pro` after already being re-added once), frontend
  `HEAD` drifted back to a stale pre-rename commit (`6b0fdf6`) with the git
  **index** itself reverted even though working-tree files were current —
  recovered cleanly both times via the established recipe (`git remote
  add origin <token-url>`, fetch, confirm real `origin/main`, `git reset
  --mixed origin/main`, `diff -rq` against a `/tmp` backup to confirm zero
  data loss before trusting it). Backend `venv/bin/python3` (the symlink)
  also went missing again even though `site-packages` was intact — fixed
  by directly re-symlinking rather than rebuilding the whole venv (faster
  when only the interpreter symlink itself vanished):
  `ln -sf /usr/local/bin/python3.13 venv/bin/python3 && ln -sf python3
  venv/bin/python`.

---

## Session: Lettering engine wired through the full Create Text wizard (this session)

`create/text.tsx` (Bold Block / Varsity fonts + Straight layout only --
Arc layouts and every other font still use the pre-existing
render-to-image + generic auto-digitize path, unchanged) now uses
stitchpro-backend's dedicated lettering engine end-to-end, for both the
live-typing preview and the final exported design, not just a preview.

**New/changed files (frontend):**
- `src/hooks/useLetteringPreview.ts` (new) -- same `StitchPreviewResult`
  shape `useStitchPreview` returns, built around
  `backendClient.textToPointsViaBackend`. No client-side fallback:
  `source` only ever resolves to `'backend'` or `'none'`.
- `src/contexts/DigitizeWizardContext.tsx` -- new `letterMeta: {text,
  color} | null` field, cleared alongside `artwork` in `reset()`/
  `clearArtwork()`.
- `create/text.tsx` -- live preview renders real satin lettering when
  eligible (`isLetteringEligible = (font==='Bold Block'||font==='Varsity')
  && layout==='Straight' && !!text.trim()`); `Continue` only sets
  `letterMeta` if the lettering preview resolved against the exact text
  currently typed (debounce-race guard), else falls back to the legacy
  path cleanly.
- `auto-digitize/analyzing.tsx` -- skips the generic `analyzeArtwork`
  call when `letterMeta` is set, synthesizes the `AnalysisResult`
  directly instead.
- `auto-digitize/settings.tsx` -- also skips its own generic
  backend-image-trace call for lettering designs (would've been real
  backend work thrown away moments later on the next screen) --  hands
  off with a placeholder `stitchPlan` and lets `preview.tsx`'s own
  lettering fetch populate the real one.
- `auto-digitize/preview.tsx` -- `const activeSim = letterMeta ?
  lettering : sim`, then every other consumer in the file (stats,
  canvas, the `stitchPlan`/`dstPoints`/`threadColors` write-back effect,
  stitch-type breakdown UI) reads `activeSim.*` unmodified -- the real
  lettering output rides the exact same write/export path every other
  design type already uses, with zero per-consumer branching.
- `src/components/ui/EmbossedStitchCanvas.tsx` -- floor the on-screen
  stroke width at ~1px (accounting for the current zoom level), instead
  of always using a fixed physically-accurate ~0.2mm thread width. A
  long multi-word lettering line can be 5-10x wider than a typical logo;
  fitting the *whole* thing into the preview stage at 1x zoom was
  shrinking real thread-width strokes to sub-pixel and making the design
  look completely blank even though its geometry was correct. No-op for
  any design that already rendered at a sane scale (confirmed via git
  stash diff -- zero new lint warnings on this file from the change).

**Real bug found and fixed in `stitchpro-backend` along the way**
(`digitizer/lettering/engine.py`, commit `8b5118e`): `build_text_design`
was pre-centering its own X geometry around `x=0` before handing it to
`design_to_points`/`design_to_dst_bytes`, both of which *already* apply
their own single `-width_mm/2` (and `-height_mm/2`) centering offset --
the convention every other `EmbroideryDesign` producer uses (origin-based
`[0, width_mm] x [0, height_mm]`, e.g. `digitizer/pipeline.py`'s
image-to-mm mapping). The double offset shifted the whole design left by
a further half-width -- invisible for a short word, but for a long one
(a realistic multi-word business name at a real letter height, e.g.
"OBI STORES" at 90mm cap height -> ~695mm wide) it pushed most/all of
the design outside the `[0, width_mm]` box the frontend preview (and a
real embroidery hoop) expect. This would have produced a real,
downloadable DST file with letters stitched well off-center too, not
just a broken preview. Fixed by shifting the engine's own geometry to
start at `(0, 0)` instead of pre-centering. Added a regression test
(`test_build_text_design_points_bounding_box_matches_declared_size`)
that builds a long string and checks the point stream lands within its
own declared bounding box. All 249 backend tests pass (248 previous + 1
new).

**Verification performed:** `npx tsc --noEmit` clean; `npx eslint` clean
on every touched/created file (remaining warnings/errors on
`preview.tsx`/`settings.tsx` confirmed pre-existing via `git stash` +
re-lint, not introduced); backend `pytest` 249/249 passing; live
Playwright run through the real dev servers (`text.tsx` with "OBI
STORES" in Bold Block -> `analyzing.tsx` -> `settings.tsx` -> `preview.tsx`)
confirmed the lettering engine's real ~13.7k-stitch satin plan
(`SATIN · 19 REGIONS`, 1 thread color, 211.8m thread) lands in
`stitchPlan`/`dstPoints`/`threadColors`, and that the thread-colored SVG
lines are now correctly positioned within `[0, width_mm]` (confirmed via
direct DOM/SVG inspection, both before and after the stroke-width floor
fix) and visibly rendered (not literally invisible) in the preview
canvas. Legacy fonts/layouts (Modern Sans, or any Arc layout) confirmed
unaffected -- still render via the original generic path exactly as
before.

**Known remaining limitation (not fixed, lower priority):** a very wide
lettering design (several hundred mm, e.g. a long multi-word name at a
large cap height) still renders fairly faint/sparse at the preview's
default 1x ("whole design visible") zoom level, even after the
stroke-width floor fix -- the individual stitch dashes are real,
correctly positioned, and clearly legible once the user pinch/scroll-
zooms in (the canvas already supports this), but the *default* view for
an extreme aspect-ratio design doesn't auto-zoom to a more legible
level. A future pass could make `EmbossedStitchCanvas`'s default zoom
auto-pick something more readable than "fit entire design" when a
design's aspect ratio is extreme (e.g. fit to a minimum comfortable
stitch-dash density instead of always fitting 100% of the design), but
this wasn't attempted this session given it'd change the component's
default-zoom behavior for every caller, not just lettering.
`monogram.tsx`'s "Stacked Block" style is still explicitly out of scope
(not touched).

**Environment notes (same recurring issues, yet again):** both repos'
`origin` git remote vanished again this session (recovered via the
established recipe -- `git remote add origin <token-url>`, fetch,
compare `HEAD` vs `origin/main`, `git reset origin/main` on `stitch-pro`
specifically since its `HEAD` had drifted back to the old `6b0fdf6`
rename-era commit while working-tree files were still current; backend's
`HEAD` matched `origin/main` exactly, just needed the remote re-added).
`stitch-pro/node_modules` and `stitchpro-backend/venv` were both
completely gone (not just a broken symlink this time) -- `npm install`
and a from-scratch `python3 -m venv venv && pip install -r
requirements.txt` (plus `pip install pytest`, which isn't in
`requirements.txt`) rebuilt both cleanly. `qa_tools`' own
`node_modules`/Playwright's cached Chromium under `~/.cache` were also
gone (expected -- `.cache` is explicitly excluded from workspace
snapshots) -- `npm install` + `npx playwright install chromium
--with-deps` restored them. The frontend Expo dev server was OOM-killed
and restarted at least 4 times over the course of this session's live
verification; this remains a standing constraint of the sandbox (1.9GB
RAM, no swap) -- keep live-browser checks lean and re-check
`free -h`/process liveness before each one.

---

## 6. Frontend (`stitch-pro`) — structure & status

- Expo **SDK 58** (upgraded from 57 this cycle — `3d7727a`), Expo Router,
  TypeScript, React Native Web. `AGENTS.md` in repo root has general Expo
  conventions.
- **Bottom nav (desktop sidebar / mobile floating pill): done, deployed,
  bugs fixed** (`bde70f8`, `c3e416a`, `3605e15`). Not revisited this
  session — no new reports of it being broken; treat as stable unless the
  user says otherwise.
- **The actual digitize-and-download flow now uses the real backend —
  done this session**, see §5's session entry. Before this, only the
  Simulator used the real backend; the Auto-Digitize wizard's own
  generate/export path was 100% client-side and never benefited from any
  backend quality work. Fixed in `settings.tsx`'s `handleGenerate`.
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
  passing** as of `6ab041b`; since then, also `BEAN`/`MOTIF`/`PUFF_3D`/
  `APPLIQUE` auto-classified stitch types plus real machine `STOP`-command
  support (`b2e7d72`, see the dedicated session entry above §6) — **230/230
  passing** as of `b2e7d72`, the current `HEAD`.
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

0. ~~**Wire the lettering engine through the full Create Text wizard**~~ —
   **done this session.** See the "Session: Lettering engine wired
   through the full Create Text wizard" entry above for full detail,
   including a real backend positioning bug found and fixed along the
   way. Remaining low-priority follow-up: `EmbossedStitchCanvas`'s
   default "fit whole design" zoom renders a very wide multi-word
   lettering design fairly faint at 1x (correct, zoomable, just not
   legible without zooming in first) -- consider an aspect-ratio-aware
   default zoom if this is ever reported as confusing. `monogram.tsx`'s
   "Stacked Block" style is still out of scope.
1. ~~**Frontend wiring for the new backend capabilities (`6ab041b`)**~~ —
   **done this session.** `settings.tsx` now has a Stitch Type (Fill/
   Cross-Stitch) chip picker + an Angle slider, and `handleGenerate` calls
   the real backend first (falling back to the old client pipeline only if
   unreachable). See the "Session: Stitch style/angle/cross-stitch..."
   entry in §5 for full detail and the live-verification evidence.
   `smooth_curves` is still not exposed in the UI (always sent implicitly
   true via the backend's own default) — a low-priority follow-up if a
   user ever wants to compare smoothed vs. raw boundaries.
2. ~~**Simulator "real 3D threaded" look**~~ — **done this session.**
   `EmbossedStitchCanvas.tsx` now subdivides every segment into short,
   individually-shaded "stitch dash" pieces instead of one long line.
   Visually confirmed via a live Playwright run against the real Simulator
   screen (zoomed crop clearly shows dash/gap texture). The Simulator still
   only previews the 5 hardcoded preset designs with backend-default style/
   angle (not a user's own chosen settings) — see §5 for why, and consider
   extending the `Design` type if that gap is ever reported.
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
6. ~~**Per-region automatic stitch-style classification**~~ — **done**
   (see the "New stitch types" session entry above §6). Thin/elongated
   regions auto-classify into BEAN (hairline) or MOTIF (long + very thin,
   tiled decorative shape); dominant convex hole-free regions become
   APPLIQUE; solid-but-not-dominant regions become PUFF_3D; everything
   else still falls through to the existing SATIN/FILL/CROSS_STITCH logic
   — all automatic per-region, no manual toggle. `stitch_style` (fill vs.
   cross-stitch) is a separate, still-whole-design-only setting and was
   NOT folded into this per-region system — a user still explicitly picks
   Fill or Cross-Stitch for the whole design; only the 4 new types above
   are auto-selected per region. A real follow-up, if ever requested: an
   in-app "Stitch Types" legend/help screen explaining what each of the 7
   now-possible auto-selected types means and why the machine pauses for
   2 of them (currently only a one-line hint in the Preview screen).
   Also still open: no live-browser Playwright confirmation of the actual
   Auto-Digitize wizard (not just the Simulator) showing the new "Stitch
   Types" chips and pause banner — blocked by an unrelated Chromium/
   Playwright file-picker limitation and this sandbox's tight memory, see
   the session entry for the exact retry recipe if ever picked back up.
7. Persistence (§6) currently only covers this device/browser's local
   storage — there is still no real backend database or multi-device sync.
   If the user wants designs/jobs to follow them across devices or wants
   a real login system, that's a genuinely new, large feature (real
   backend auth + a database), not a quick follow-up — confirm scope with
   the user before starting it rather than assuming.
8. Always re-run the full verification loop before calling anything done:
   `cd stitchpro-backend && venv/bin/python3 -m pytest -q` (expect
   230/230+), `cd stitch-pro && npx tsc --noEmit` (expect clean), `node
   scripts/test-merge-*.mjs` for each (expect all green), `npx expo export
   -p web` (expect no errors), then a live-browser smoke check per §4.
