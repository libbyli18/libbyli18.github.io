# Project Spec: Personal Portfolio Website (libbyli.me)

**Purpose of this document:** a factual reference for generating resume bullets,
cover letter paragraphs, and interview talking points about this project.
Pull whatever's relevant to a given application — don't use all of it at
once. Section 11 has guidance on what to emphasize for different role types.
Section 10 lists what NOT to claim. When in doubt, favor the specific,
verifiable details in Sections 5, 6 and 8 over generic phrasing.

The project has two parts: the **website** (Sections 4–5) and **Darkroom**,
the self-hosted photo-upload backend it pulls photos from (Section 6).

---

## 1. Quick facts

| | |
|---|---|
| **What** | A photography portfolio website with a floating 3D hero, scroll-driven photo transitions, a pannable photo grid and a gallery viewer — plus a self-hosted backend for uploading new photos to it |
| **Live at** | libbyli.me (site) · upload.libbyli.me (upload page and API) |
| **Role** | Sole developer — designed, built, tested, deployed, and iterated on every part |
| **Stack (site)** | Vanilla JavaScript, HTML5, CSS3 — no JavaScript frameworks or libraries (Tailwind CSS via CDN for utility classes, Google Fonts); hosted on GitHub Pages with a custom domain over HTTPS |
| **Stack (backend)** | Node.js + Express, SQLite (better-sqlite3), nginx, Let's Encrypt, systemd, on an Ubuntu 24.04 Linux VM on Microsoft Azure |
| **Scope** | Site: a single HTML file (~2,300 lines of markup, CSS and JS) plus a ~130-line Node.js build script. Backend: ~290 lines across the API server, database schema and upload page |
| **Status** | Both live and in use — 61 photos on the site, 45 of them across 4 galleries uploaded through the backend, at the time of writing |

---

## 2. Summaries (pick the length that fits)

**One line:**
Built and shipped a fully animated photography portfolio site from scratch in vanilla JavaScript, with photos that fly between a floating 3D hero, a pannable grid and a gallery viewer, landing pixel-exact every time.

**Two lines:**
Designed and engineered a photography portfolio site with no JavaScript frameworks, including FLIP-based 3D photo transitions, a computed layout that spaces any number of photos evenly around the hero text, spring-physics panning, and a real loading screen that turns into the cursor. Verified the motion frame-by-frame with headless-browser pixel diffs, and diagnosed bugs down to how browsers resample and composite transformed images.

**Paragraph (for cover letters):**
I designed and built a photography portfolio site in vanilla JavaScript, HTML and CSS — no frameworks, every animation and interaction hand-engineered. Scrolling on the homepage sends each floating 3D photo flying to its exact spot in a pannable grid; clicking a photo opens its whole gallery as a strip that unfolds from behind it. Getting that to feel seamless took real engineering: reproducing each card's 3D tilt and perspective in the flying copy, freezing and resuming CSS animations at the exact frame, and tracking down why a photo looked a hair different the instant it landed (browser image resampling, a texture overlay drawn on top, a shadow). I didn't trust my eyes — I wrote headless-browser scripts that compared screenshots pixel by pixel until the hand-off between moving copy and real photo changed zero pixels.

**Backend (Darkroom), one line:**
Built and deployed a self-hosted photo-upload service — a Node.js/Express API with a SQLite database behind nginx and HTTPS on a Linux VM in Azure — that lets new photo galleries go live on the portfolio site without touching code.

**Backend, two lines:**
Provisioned and hardened an Ubuntu server on Azure (SSH keys only, firewall, Let's Encrypt TLS) and deployed a token-protected Node.js/Express upload API behind an nginx reverse proxy, run as a systemd service. Uploads are validated by their actual file contents, stored with server-generated names, and served to the static site over a CORS-restricted read API.

**Whole project, paragraph (for cover letters):**
Alongside the site, I built the backend it runs on: a small photo-upload service I deployed myself on a Linux virtual machine in Azure. I set up the server from scratch — SSH-key-only access, a firewall, nginx as a reverse proxy, free auto-renewing HTTPS certificates, and a systemd service so the app restarts on its own — and wrote the Express API, SQLite schema and upload page. Running a real server meant debugging real production problems, like tracing a cryptic browser error back through nginx's logs to a request-size limit, then fixing it at the root by resizing photos in the browser before they're ever sent.

---

## 3. How this was built (context for honest interview answers)

This was AI-assisted development — built through iterative direction, review,
and testing with an AI coding assistant (Claude), not typed line-by-line
unassisted. **This is worth being upfront and specific about, not vague
about**, because:

- It's true, and interviewers can generally tell when someone is fuzzy about
  authorship.
- AI-assisted development is a real, increasingly-expected skill, not
  something to downplay. Directing an AI tool effectively — knowing what to
  ask for, catching wrong or subtly-broken output, verifying claims instead
  of trusting them, deciding when a proposed approach is wrong and pushing
  back — **is itself the skill being demonstrated**, and it's a fair thing
  to name directly in an interview.
- Every technical decision (architecture, what to fix, what tradeoffs to
  accept), every round of testing, and every review of the actual behavior
  was yours. That's genuinely substantive ownership, and it's distinct from
  "I asked an AI to build me a website" — the difference is in the level of
  direction and verification involved, which was high throughout.

**A good, honest way to describe it if asked directly:** *"I used an AI
coding assistant heavily for this — I directed the architecture and every
feature decision, reviewed and tested everything it produced, and did the
actual debugging work of diagnosing root causes when something didn't work
correctly. It's not a project I'd claim I hand-typed alone, but the design
decisions, the QA process, and the judgment calls were mine."* That answer
tends to land far better than either overclaiming solo authorship or being
evasive about tooling.

---

## 4. Technical architecture

- **Single-file design:** the whole site — markup, styles and logic — lives
  in one `index.html`, deliberately, to keep it inspectable with no build
  step, bundler or framework. Styling uses Tailwind CSS from its CDN for
  utility classes alongside hand-written CSS; there are no JS libraries.
- **Two views, hash routing:** the hero (`#home`) and the photo grid
  (`#work`), switched in JavaScript with animated transitions; the URL hash
  keeps the grid linkable and makes the browser's back button work.
- **Data model:** a list of galleries, each holding an ordered set of photos
  (a single photo is a gallery of one). The grid and hero show photos
  individually; the gallery structure is used by the viewer.
- **Two photo sources, one shape:** galleries come from a build-time manifest
  (`photos-data.js`, generated from local folders by `build-photos.mjs`)
  and from the live upload API (Section 6). Both produce the same shape, so
  nothing downstream knows the difference; if the API is slow or down, a
  4-second timeout falls back to the local photos.
- **Rendering approach:** motion uses CSS transforms and opacity (composited
  on the GPU) driven by CSS transitions, keyframes, the Web Animations API
  and `requestAnimationFrame` loops that stop once everything settles.
- **Hosting:** GitHub Pages with a custom domain and enforced HTTPS.

---

## 5. Feature-by-feature technical breakdown

Each entry: what it is → the hard part → how it was solved → what it demonstrates.

### Loading screen that becomes the cursor
A single ring in the middle of a blank page draws itself round as the site
loads, then shrinks into the custom cursor and glides to wherever the mouse
is. The progress is real, not a timed spinner: a weighted sum of what the
first screen actually needs — page parsed (10%), web fonts (15%), photo data
including the live API (15%), every hero photo downloaded *and decoded*
(50%), and the hero layout computed (10%). The arc eases toward that sum and
never moves backwards. The hand-off is pixel-identical because the ring's
last frame is drawn with exactly the same CSS technique as the cursor (an
SVG stroke turned out to anti-alias slightly differently). The hero's own
entrance animation waits, paused, until the cover lifts; a 15-second safety
cutoff means a stalled request can never trap a visitor on the loader.
**Demonstrates:** measuring real load state (Font Loading API, image
`decode()`, async data), continuity as a design goal, defensive timeouts.

### Floating 3D hero with a computed layout
The homepage shows the most recent photos (up to 30; 14 on phones) drifting
in a shallow 3D field around the name, each on its own slow keyframe loop
with a random duration and phase. Their positions aren't hand-placed — they
are computed for whatever number of photos exists:
- **Size:** each card gets the same *area* whatever its shape, and together
  they cover a fixed share of the free space, so 2 photos are large and 30
  are small.
- **Placement:** a greedy "farthest point" heuristic over a grid of candidate
  positions puts each card as far as possible from the others, the page
  edges and the text (whose real positions are measured from the layout),
  then several refinement passes re-place each card against all the others
  to even out the gaps. A hard clearance keeps cards off the words even
  while they drift.
- **Responsive by computation:** the layout re-runs on resize instead of
  relying on breakpoints; tested from 1 to 30 cards on desktop and phone.
**Demonstrates:** algorithmic thinking applied to layout (a spatial
optimisation heuristic), responsive design driven by measurement.

### Scroll-driven flight from the hero into the grid (and back)
One scroll on the homepage fades the words out, then sends each floating
photo flying, one after another, to its own slot in the photo grid; photos
that weren't on the hero grow out from behind the nearest landing photo.
"← Home" plays it in reverse. The hard parts:
- **Starting exactly where the photo is:** the drift animation is frozen at
  its current frame (reading the running animation through the Web
  Animations API) so nothing moves while the words fade, and later resumed
  from the same phase.
- **Keeping the 3D tilt:** each flying copy starts as an exact replica of a
  tilted card under 3D perspective. Its transform reproduces the card's own
  transforms with the perspective re-centred on the hero's vanishing point,
  and ends on a matching list of identity transforms so the browser
  interpolates each piece smoothly (FLIP: First, Last, Invert, Play).
- **A pixel-exact landing:** the moving copy is laid out at the native size
  of the end it starts from, and over the last moments, when it is under
  half a pixel from its slot, a still copy at the grid photo's exact size
  fades in over it — so the real photo replaces something identical.
- **Choreography:** the "← Home" button fades in as the exact complement of
  the words fading out (their opacities sum to 1 on every frame), the
  page's texture overlay stays on top of the flying photos just as it does
  over the real ones, and the transition waits for the words to finish.
**Demonstrates:** advanced animation engineering, deep knowledge of browser
rendering (3D transforms, perspective, compositing, image resampling),
precision as a measurable goal rather than a feeling.

### Pannable photo grid with justified rows and spring physics
The grid is a canvas larger than the screen in both directions, panned by
scroll, trackpad or dragging. Motion runs through a custom critically
damped spring on each axis (not CSS `scroll-behavior` or a library), with
input softened near the edges so the canvas drifts into its boundary
instead of hitting a hard stop; tuning it meant deriving the no-overshoot
condition for the integrator (`(1 + d − dk)² ≥ 4d`). Photos are laid out
in justified rows: every photo in a row shares a height and keeps its
shape, each row is scaled so both ends line up, and row breaks are chosen
to keep heights near the target. The canvas is shaped like the screen, so
there is as much to explore across as down, and it re-flows on resize
while keeping your place. Hovering a photo shows its gallery's name.
**Demonstrates:** applied math in code, a classic layout algorithm,
interaction design with physical feel.

### Gallery viewer that unfolds from the photo you click
Clicking any photo flies it to the centre of a dark backdrop (FLIP again),
then the rest of its gallery slides out from behind it into a strip on
either side, in the gallery's own order. Scroll, swipe, the arrow keys or
clicking a neighbour moves along one photo per gesture (a cooldown stops a
fast trackpad flick from racing through the set). Closing folds the others
back and flies the current photo home to *its own* slot in the grid, then
returns keyboard focus there. Leaving the grid while the viewer is open
closes it instantly and cleanly.
**Demonstrates:** stateful UI with interruptible animations, input handling
across mouse/trackpad/touch/keyboard, focus management.

### Seeded layout randomness
Arrangements (grid order, hero order and sizes, drift timings) come from a
seeded pseudo-random generator (mulberry32) with string-hash seeds salted
once per page load: every visit gets a fresh arrangement, but it never
reshuffles during a visit — including when the layout is recomputed on
resize.
**Demonstrates:** hashing and PRNGs, controlling randomness rather than
just using it.

### Custom cursor
A ring cursor trails the pointer slightly (a plain per-frame interpolation,
so it tracks closely without feeling laggy), fills solid over links and
buttons, and is replaced by a "Scroll to discover" label inside the gallery
viewer. `mix-blend-mode: difference` keeps it legible on both the cream
page and dark photos. Its animation loop stops as soon as it catches up.
**Demonstrates:** `requestAnimationFrame` lifecycle management, CSS
blending techniques, state-driven UI.

### Dependency-free image metadata tool
A Node.js build script reads real width/height straight from JPEG and PNG
files by parsing their binary headers byte by byte (PNG `IHDR` chunk;
JPEG `SOF` markers) — no image library. It supports a folder-based
workflow: a loose image is a single-photo gallery, a folder of images is one
gallery named after the folder, and folders without images are looked
inside, purely for organising; order follows filename numbering.
**Demonstrates:** binary file formats, building internal tooling, designing
a workflow for a non-technical user.

### Accessibility and performance
Keyboard support throughout (Enter/Space opens photos, arrow keys and
Escape in the viewer, visible focus states), focus returned to a sensible
place after closing the viewer, hidden controls made unreachable
(`inert`) rather than just invisible, purely decorative layers hidden
from screen readers, and `prefers-reduced-motion` respected by the main
animation systems (the hero-to-grid transitions jump straight to their end
state, the drift stops, the loader skips its shrink). Animation loops stop once everything
is at rest instead of running every frame.
**Demonstrates:** accessibility as part of the build, not a checklist at
the end; performance awareness.

### Systematic QA methodology
Changes were verified with dozens of small, purpose-built headless-browser
scripts (Puppeteer) rather than by eye: measuring element positions on
every animation frame, timing sequences, and comparing screenshots taken
just before and after each hand-off pixel by pixel. This caught issues
like a race condition between asynchronous scroll events and element
visibility, a flying photo that changed 14% of its pixels the instant it
landed, and photos that only "popped in" once the library grew larger than
the hero could show — a bug invisible with the smaller test data.
**Demonstrates:** a genuine testing discipline — verifying claims
computationally, and testing with realistic data.

---

## 6. Darkroom: the photo-upload backend

A separate, self-hosted service that lets new photo galleries be published
to the site from a web page, with no code change or redeploy. Same entry
format as Section 5: what it is → the hard part → how it was solved → what
it demonstrates.

### Architecture at a glance

```
Browser upload page ──HTTPS──▶ nginx (TLS, size limit) ──▶ Express API (systemd)
                                                            ├─ SQLite: galleries + photos
                                                            └─ uploads/ folder (photo files)
Portfolio site (GitHub Pages) ──HTTPS GET /api/photos──▶ same API (CORS: site only)
```

- **Server:** Ubuntu 24.04 LTS virtual machine on Microsoft Azure, reached
  at `upload.libbyli.me` via a DNS record for the subdomain.
- **App:** Node.js 20 + Express 5; ~290 lines total across the server
  (`server.js`), schema (`db.js`) and upload page (`admin.html`).
- **Data:** SQLite through better-sqlite3 — a `cards` table (one row per
  gallery: its name) and a `photos` table (file name, width, height, and its
  position within the gallery).
- **Integration with the site:** the static site fetches `GET /api/photos`
  on load and merges those galleries with the ones built from local
  folders. Both arrive in the same data shape, so nothing downstream can
  tell where a gallery came from. If the server is slow or down, a 4-second
  timeout lets the site fall back to its local photos instead of hanging.

### Linux server setup and hardening
Provisioned the VM and configured it from the command line:
- **Access:** SSH with key-based login only; password login is disabled.
- **Firewall:** `ufw` allows only SSH and web traffic (ports 80/443), so the
  Node app's own port is never exposed directly.
- **HTTPS:** Let's Encrypt certificates issued with certbot, renewed
  automatically by a systemd timer; plain-HTTP requests redirect to HTTPS.
- **Process management:** the app runs as a systemd service under a
  non-root user, with `Restart=always` so it comes back after crashes and
  reboots. The upload secret is kept in the service's environment, not in
  the code or the repo.

**Demonstrates:** Linux administration, networking fundamentals (DNS,
ports, firewalls, TLS), and operating a service rather than just writing one.

### nginx reverse proxy
nginx sits in front of the app: it terminates TLS, forwards requests to
Express on localhost, caps request size, and serves as the single public
entry point.
**Demonstrates:** standard production web architecture (reverse proxy +
app server), configuring and reloading nginx safely (`nginx -t` before
reload).

### Upload API and validation
`POST /api/upload` takes a gallery name and up to 60 photos in one request
(multipart form data, handled by multer). Security and integrity decisions:
- **Authentication:** a bearer token checked on every upload; reads are
  public, uploads are not.
- **Rate limiting:** 10 upload requests per minute (express-rate-limit).
- **Content validation:** each file is checked by its actual bytes
  ("magic numbers", via the `file-type` library), not by its name or the
  browser's claimed type, so a renamed non-image is rejected.
- **Safe storage:** files are saved under server-generated UUID names; the
  uploader's filename is never trusted or used as a path.
- **All-or-nothing uploads:** every file is validated before anything is
  written to the database; if one file fails, all files from that request
  are deleted, so a half-created gallery can't exist.
- **Size limits:** 15 MB per file in the app and a request-size cap in
  nginx, both reported on the upload page as plain-language errors.
- **CORS:** the read API only answers browser requests from the portfolio's
  own domain.

**Demonstrates:** REST API design, defensive input validation, basic
application security (authN, rate limiting, upload hardening, CORS).

### Read API shaped for the frontend
`GET /api/photos` returns one entry per gallery with its photos nested in
order, built with a single SQL join and grouped in code. It's the exact
shape the site's grid and gallery viewer already used, so integrating the
live data needed no frontend changes beyond the fetch.
**Demonstrates:** designing an API around its consumer, relational data
modeling, SQL joins.

### Browser-side image processing on the upload page
The upload page resizes photos in the browser before sending them: anything
over 2400px on its long side (or over 2 MB) is redrawn on a `<canvas>` and
re-encoded as a high-quality JPEG. This also converts iPhone HEIC photos,
which the site couldn't otherwise display. The page shows per-photo
preparation progress, a live upload percentage (XMLHttpRequest progress
events), and plain-language errors.
**Demonstrates:** moving work to the client to reduce bandwidth and server
load, the Canvas API, UX for failure states.

### Schema evolution without a migration
When galleries stopped having categories, the API dropped the category
requirement but still honoured the old `?category=` query, so the
already-deployed site kept working whichever half (site or server) was
updated first. No database migration was needed.
**Demonstrates:** backward compatibility across independently deployed
components, thinking about deploy order.

### Deployment practice
Deploys are manual but careful: checksums of the files on the server are
compared against the repo before overwriting (to catch drift), the previous
versions are backed up on the server, configs are syntax-checked before
reload, and each change is verified against the live endpoints afterwards.
Before deploying, changes were tested against a local copy of the server
(fresh database, real requests via curl and a headless browser).
**Demonstrates:** release discipline and verification habits, even
without CI/CD.

---

## 7. Skills & technology keyword list

**Languages:** JavaScript (ES6+), HTML5, CSS3, Node.js, SQL

**Frontend concepts:** DOM manipulation, CSS animations & transitions,
CSS 3D transforms & perspective, Web Animations API, `requestAnimationFrame`,
CSS custom properties (variables), responsive/mobile-first design, Tailwind
CSS, `IntersectionObserver`, Font Loading API, image `decode()`, hash-based
routing, accessibility (ARIA, keyboard navigation, focus management,
`inert`), `prefers-reduced-motion`, CSS stacking contexts & `z-index`,
`mix-blend-mode`, `fetch` with timeouts (AbortController)

**Techniques & patterns:** FLIP animation technique, spring/physics-based
motion, justified-row layout, greedy spatial placement heuristics, seeded
pseudo-random number generation, hashing, debouncing/throttling for scroll,
wheel and resize events, view routing, graceful fallback when an API is
unavailable

**Tooling & methodology:** Node.js scripting (file I/O, binary buffer
parsing), Puppeteer (headless browser automation & testing), Git, curl,
automated visual regression testing (screenshot pixel diffs), frame-by-frame
animation measurement

**Systems/format knowledge:** binary file format parsing (PNG, JPEG headers),
static site architecture, build tooling design

**Backend:** Node.js, Express, REST API design, SQLite (better-sqlite3),
SQL joins & relational schema design, multipart file uploads (multer),
file-content validation (magic numbers), bearer-token authentication, rate
limiting, CORS, JSON APIs, Canvas API (client-side image resizing)

**Infrastructure & ops:** Linux (Ubuntu), Microsoft Azure (virtual
machines), SSH key authentication, ufw firewall, nginx (reverse proxy, TLS
termination), Let's Encrypt / certbot, HTTPS, DNS, systemd services,
reading server logs (nginx, journalctl), manual deployment with backups &
rollback, GitHub Pages hosting & custom domains

**Soft/process skills:** independent debugging & root-cause analysis,
iterative design based on visual/functional review, directing and
verifying AI-assisted development, technical writing/documentation (this
spec, the project's own build documentation)

---

## 8. Quantifiable metrics bank

Use these as the "measured by" clause in bullets — all verified during
development, not estimated:

- Hand-off from moving copy to real photo: **0 changed pixels** in before/after screenshot diffs, on desktop and phone (was up to **14%** before the fixes)
- Flying copies start within **0.5px** of the card they replace (first frame vs. last still frame)
- Loading ring's final frame is **pixel-identical** to the cursor it becomes
- Home button and hero words fade as exact complements: opacity sum error **0** across every frame
- Hero layout tested with **1 to 30** photos on desktop and phone: **0** overlaps with text, other cards or page edges; computes in under **100 ms** for 15 cards
- Grid layout gives landscape photos about **2×** the area of portrait ones (measured 1.98–2.08 across 61 photos)
- **61 photos** live across the site at the time of writing
- **Dozens of automated test scripts** written and run to verify behavior, not appearance alone
- **Over a dozen distinct bugs** found and root-caused via automated testing before user impact
- Custom image-metadata tool: **zero external dependencies**, parses 2 binary file formats from raw bytes

Backend (Darkroom):
- **45 photos across 4 galleries** published through the upload service at the time of writing (real use, by the site's owner — not visitor traffic)
- Upload service in **~290 lines** of code, using **7 npm packages**
- Up to **60 photos per gallery** in a single upload request
- Client-side resizing cut a test 4.4 MB camera photo to **~730 KB** before upload (≈6× smaller)
- Upload rate-limited to **10 requests/minute**; **15 MB** per-file cap
- Public surface limited to **2 open ports** (SSH, HTTP/HTTPS) by firewall; password SSH login **disabled**
- HTTPS certificates on **both domains**, renewed automatically

---

## 9. Narrative anecdotes (for cover letters / STAR-format interview answers)

**The scroll race condition (good for: "tell me about a hard bug you fixed"):**
*Situation:* After building a feature that lets users fly into a specific
scroll position in a gallery, the very first scroll gesture a visitor made
would snap the view back to the start, undoing the positioning.
*Task:* Figure out why, when every value I could directly inspect looked
correct.
*Action:* I instrumented the internal animation state directly rather than
guessing, and traced it to a genuine browser quirk: an element being
measured while temporarily hidden (`display: none`) reports its scroll
position as zero, and the browser's own scroll event for a real position
change can fire *after* that hidden window closes — silently overwriting
correct state with stale zero.
*Result:* Fixed by resyncing state at the one moment in the render
lifecycle guaranteed to be accurate — after the element is genuinely,
permanently visible — rather than trusting the browser's own event timing.
*Why it's a good story:* it shows debugging methodology (measure, don't
guess), and a real, subtle browser behavior most developers wouldn't know
to look for.

**The photo that "jumped" when it landed (good for: "tell me about something you're proud of" / creative-technical roles):**
*Situation:* Photos flew from the homepage into the grid smoothly, but at
the very end each one seemed to twitch — a tiny shift in position and
shading the moment the animation handed over to the real photo.
*Task:* Make the hand-off genuinely invisible, at every screen size.
*Action:* Instead of tweaking by eye, I captured screenshots just before
and just after the hand-off and diffed them pixel by pixel. That showed four
separate causes: the flying copy kept a drop shadow the grid photo didn't
have; it flew above the page's film-grain texture, which then "appeared" on
the photo; its corners and colour treatment differed slightly; and a photo
scaled into place is resampled by the browser and looks a touch softer than
one drawn at its natural size. Each was fixed at its source — the last one
by finishing every flight on a still copy at the photo's exact size.
*Result:* The screenshot diff went from up to 14% of pixels changing to
exactly zero, in both directions and on phones.
*Why it's a good story:* it turns a vague "it looks off" into measurable
causes, and shows knowledge of how browsers actually render.

**The bug that needed more photos to appear (good for: "testing" / "what did you learn" questions):**
After more photos were uploaded, some started popping into the grid
instead of flying in. My earlier tests had passed because they used a
smaller library where every photo fit on the homepage; once there were more
photos than the hero shows, the ones not on it skipped the animation.
Fixed by having them grow out from behind the nearest landing photo — and
the lesson stuck: test with realistic data, including the data you'll have
in six months.

**Choosing not to use a framework (good for: "why did you choose X approach"):**
Deliberately built this without React, Vue, or any build step (Tailwind is
loaded from its CDN for styling utilities only) — not out of unfamiliarity,
but because a single-photographer portfolio site didn't
need the overhead, and doing the state management, DOM updates, and
animation coordination by hand forced a much deeper understanding of what
frameworks normally abstract away (render timing, reflow/repaint costs,
event delegation). Good answer to "why didn't you just use React" if asked.

**The upload that failed with a cryptic error (good for: "tell me about a hard bug" / backend & infra roles):**
*Situation:* The first real upload attempt failed on the upload page with
Safari's error "The string did not match the expected pattern" — a message
that says nothing about the actual cause.
*Task:* Find out what was really failing, with no useful error on screen.
*Action:* Recognised the message as Safari's way of saying the response
wasn't valid JSON, so something other than the app had answered. The nginx
access log showed `413` responses and the error log showed the request
bodies were 246 MB and 19 MB — far over the 15 MB request limit in nginx,
which rejected them before they ever reached the app.
*Result:* Fixed it at the root rather than just raising the limit: the
upload page now resizes photos in the browser before sending (a 4.4 MB
photo became ~730 KB), and the limits were set to match. The page also
reports failures in plain language now, instead of surfacing a parse error.
*Why it's a good story:* debugging across layers (browser → reverse proxy
→ app) using server logs, and choosing the fix that addresses the cause.

**The site that only worked over plain HTTP (good for: networking / "something you learned" questions):**
Photos uploaded through the backend weren't showing on the live site. The
cause was two layers down: GitHub Pages had never issued an HTTPS
certificate for the custom domain, so the site only loaded over `http://`,
and the upload API's CORS policy (correctly) only allowed the `https://`
origin — so the browser blocked the site's request for the photo list.
Re-provisioning the domain on GitHub Pages issued the certificate, HTTPS
enforcement was turned on, and the request succeeded. Shows understanding of
how TLS, origins and CORS interact.

**Setting up a real server from scratch (good for: "what did you learn" / infra roles):**
Rather than using a managed backend, deliberately set up a Linux VM in Azure
to learn what's normally hidden: SSH keys and disabling password login, a
firewall that exposes only the ports that should be public, nginx as a
reverse proxy, HTTPS certificates that renew themselves, and a systemd
service so the app survives crashes and reboots.

---

## 10. Do NOT claim (guardrails for the resume/cover-letter helper)

- **Keep the backend's scale honest.** Darkroom is real and deployed, but it
  is a single small VM serving one user (the site's owner) for uploads. Don't
  claim high availability, load balancing, horizontal scaling,
  performance under load, or "millions of requests".
- **No CI/CD, containers, or orchestration.** Deploys are manual (copy files
  over SSH, restart the service); there's no Docker, Kubernetes, GitHub
  Actions pipeline or infrastructure-as-code. Don't imply them.
- **No automated test suite for the backend.** It was tested by running a
  local copy and sending real requests (curl, headless browser) — say that,
  not "unit tested" or "test coverage".
- **Authentication is a single shared upload token,** not user accounts,
  OAuth, sessions or role-based access. Don't call it a "user auth system".
- **SQLite, not a database server.** Don't claim PostgreSQL/MySQL experience
  from this project.
- **The backend's code isn't on GitHub.** Its git repo is local only, so
  don't link to it or call it open source unless that changes.
- **Don't say the site has "zero dependencies".** It uses no JavaScript
  frameworks or libraries, but it does load Tailwind CSS and Google Fonts
  from CDNs. "No frameworks" or "vanilla JavaScript" is accurate.
- **No team/collaboration claims.** This was solo work. Don't write "worked
  with a team" or "collaborated with designers/engineers."
- **No React/Vue/Angular/framework experience** should be inferred from this
  project — it was built explicitly without one. If a job description wants
  framework experience, this project supports "strong vanilla JS
  fundamentals," not "React experience."
- **No production traffic/user metrics exist.** Don't fabricate visitor
  counts, performance-under-load numbers, or business impact — this is a
  personal portfolio site, not a product with real usage data.
- **Be accurate about AI-assisted development** if directly asked (see
  Section 3) — don't claim unassisted solo authorship if pressed.

---

## 11. Tailoring guidance by role type

**Frontend / UI engineering roles:**
Lead with the hero-to-grid flights (FLIP with 3D transforms, the
pixel-exact landing), the computed hero layout, the gallery viewer, and
the accessibility work, with the "photo that jumped" story. This project is
strongest here — it's doing things most portfolio sites don't attempt.

**General SWE / full-stack internships:**
Lead with the debugging methodology (the race condition and cryptic-upload
stories), the layout algorithms, the build tooling (binary file parsing),
the systematic testing approach, and Darkroom for the backend half. Shows
both frontend polish and end-to-end "real engineering".

**Design-adjacent / creative technologist / agency roles:**
Lead with the loading screen that becomes the cursor, the floating 3D
hero, and the gallery viewer that unfolds from the clicked photo — design
sensibility executed with real technical rigor, which is exactly what this
kind of role screens for.

**Backend / full-stack roles:**
Lead with Darkroom (Section 6): the Express API, upload validation and
security decisions, the SQLite schema, and the API designed around the
site's needs. Pair it with the "cryptic upload error" story.

**Infrastructure / DevOps / cloud / IT roles:**
Lead with the server setup: Linux on Azure, SSH hardening, firewall, nginx
reverse proxy, Let's Encrypt, systemd, DNS, and the HTTPS/CORS story. Be
clear it's a single self-managed VM (Section 10), which is still solid
hands-on signal for an internship.

**QA / DevTools / testing-focused roles:**
Lead with Section 5's "systematic QA methodology" and the specific bugs
caught — the Puppeteer-based verification approach is a genuine, unusual
signal for someone without professional QA experience.

---

## 12. Fill in before using (application-specific — not filled in here)

- School, major, expected graduation date
- Target role type(s) for this specific application
- Company/job description to tailor keyword emphasis against (cross-reference
  Section 7 against the posting's required skills — don't force-fit
  keywords that aren't genuinely represented above)
- Whether this project should be the resume's primary project or a secondary
  one alongside coursework/other experience
