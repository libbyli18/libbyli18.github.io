# Project Spec: Personal Portfolio Website (libbyli.com)

**Purpose of this document:** a factual reference for generating resume bullets,
cover letter paragraphs, and interview talking points about this project.
Pull whatever's relevant to a given application — don't use all of it at
once. Section 10 has guidance on what to emphasize for different role types.
Section 9 lists what NOT to claim. When in doubt, favor the specific,
verifiable details in Sections 5 and 7 over generic phrasing.

---

## 1. Quick facts

| | |
|---|---|
| **What** | A photography portfolio website with custom scroll physics, page transitions, and a procedurally-generated placeholder system |
| **Live at** | libbyli.com |
| **Role** | Sole developer — designed, built, tested, and iterated on every part |
| **Stack** | Vanilla JavaScript, HTML5, CSS3 — zero frameworks, zero runtime dependencies |
| **Scope** | Single self-contained HTML file (~1,600+ lines), plus a small Node.js build script |
| **Status** | Live and functional; photo-upload backend (separate project) planned but not yet built — see Section 9 |

---

## 2. Summaries (pick the length that fits)

**One line:**
Built and shipped a fully animated photography portfolio site from scratch in vanilla JavaScript, with custom physics-based scrolling, procedural layout generation, and cinematic page transitions.

**Two lines:**
Designed and engineered a photography portfolio website as a single dependency-free file, implementing custom spring-physics scrolling, a deterministic procedural layout engine, and FLIP-based match-cut page transitions. Independently diagnosed and fixed over a dozen production bugs — including a browser-level race condition — using a self-directed automated testing methodology.

**Paragraph (for cover letters):**
I designed and built a photography portfolio website entirely in vanilla JavaScript, HTML, and CSS — no frameworks, no dependencies, every animation and interaction hand-engineered. Beyond the visual design, the project involved real systems-level debugging: tracking down a race condition in how browsers fire scroll events against elements that are being shown or hidden, building a deterministic pseudo-random layout engine so a photo grid looks organic but never breaks on reload, and writing a small Node.js tool that parses raw image file headers byte-by-byte to read real photo dimensions without a single external library. I validated the whole thing with a self-directed automated testing process, using a headless browser to catch bugs — timing races, accessibility gaps, layout regressions — before they'd ever reach a real visitor.

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

- **Single-file design:** the entire site — markup, styles, and logic — lives
  in one `index.html`, deliberately, to keep the whole system inspectable
  and dependency-free. No build step, no bundler, no framework runtime.
- **Data model:** a small in-memory object graph (`categories` →
  `images[]` → `sets[]`) where every photo "card" holds one or more
  sub-photos — the same structure serves single photos and multi-photo
  mini-galleries without a separate code path for each.
- **Placeholder-to-real-photo pipeline:** the site runs entirely on
  procedurally-generated placeholder imagery until real photos are dropped
  into a folder structure and a build script (`build-photos.mjs`) regenerates
  a data manifest — each category swaps over independently, so partial
  content never breaks the whole site.
- **No external image service, no CDN dependency:** placeholder images are
  generated as inline SVG data URIs at runtime — zero network requests,
  zero third-party failure points.

---

## 5. Feature-by-feature technical breakdown

Each entry: what it is → the hard part → how it was solved → what it demonstrates.

### Physics-based horizontal scrolling
Gallery pages scroll sideways through a scattered photo field using a
custom critically-damped spring simulation (not CSS `scroll-behavior` or a
library), so motion accelerates and decelerates naturally instead of
snapping. Required deriving the no-overshoot boundary condition
mathematically (`(1 + d − dk)² ≥ 4d`) to tune damping without the scroll
ever bouncing past its target.
**Demonstrates:** applied math/physics in code, numerical tuning, animation
engineering without relying on library abstractions.

### Match-cut page transitions
Navigating from the homepage into a gallery plays a full-screen "through the
letters" transition — a clone of the page's wordmark scales up and fades,
matched pixel-for-pixel against the real heading underneath so the cut reads
as one continuous motion, not two separate animations. Required building a
runtime coordinate-measurement system that compares font metrics, glyph
positions, and breakpoint-specific sizing between two DOM states and
corrects the offset live.
**Demonstrates:** precise DOM measurement, cross-browser layout debugging,
motion-design implementation at a level most sites don't attempt.

### FLIP-based element transitions ("flight" animation)
Clicking a photo on the homepage visually flies it into its exact landing
position inside the destination gallery — coordinated across a full page
transition happening at the same time. Uses the FLIP technique (First,
Last, Invert, Play): measuring an element's start and end position, then
animating only a CSS `transform` between them for GPU-accelerated,
layout-thrash-free motion. Includes automatic viewport scrolling so the
landing target is guaranteed visible even if it would otherwise be off-screen.
**Demonstrates:** advanced animation technique, cross-component state
coordination, defensive engineering (handling the case the naive
implementation would silently get wrong).

### Deterministic procedural layout engine
Photo scatter layouts look organic and vary between galleries, but are
fully deterministic — reloading the page never reshuffles anything. Built
on a seeded PRNG (mulberry32) with seeds derived from string hashes unique
to each gallery, so "randomness" is reproducible without ever storing
layout state.
**Demonstrates:** algorithms (hashing, PRNGs), understanding the difference
between randomness and reproducibility, a real engineering tradeoff
(seeded pseudo-randomness) applied correctly.

### Custom cursor system
A ring-shaped custom cursor tracks the pointer with its own spring-based
smoothing (independent from the scroll physics), fills solid over clickable
elements, and swaps entirely into a text label ("Scroll to discover") when
a modal viewer is open — all via CSS custom properties and a single shared
positioning loop, not separate cursor implementations per state.
**Demonstrates:** state-driven UI design, `requestAnimationFrame` lifecycle
management, CSS blend-mode techniques (`mix-blend-mode: difference`) for
guaranteed-readable UI regardless of background.

### Dependency-free image metadata tool
Wrote a Node.js script that reads real width/height directly from JPEG and
PNG files by parsing their binary headers byte-by-byte (PNG `IHDR` chunks;
JPEG `SOF` markers) — no image-processing library. Supports a
folder-based content workflow: a loose file is a single photo, a subfolder
is an automatically-detected multi-photo "mini-gallery," ordered and
titled by filename convention.
**Demonstrates:** binary/byte-level file format knowledge, building
internal developer tooling, designing a workflow for a non-technical
end-user (herself, later) rather than just an API.

### Accessibility and performance engineering
Full keyboard navigation (focus-visible states, Enter/Space activation on
custom interactive elements), ARIA labeling on decorative-but-functional
elements, `prefers-reduced-motion` support throughout every animation
system, and animation-frame lifecycle management verified to produce zero
idle CPU usage when nothing is moving.
**Demonstrates:** accessibility isn't an afterthought; performance
awareness; attention to the parts of a product that don't show up in a
screenshot.

### Systematic QA methodology
Rather than eyeballing changes, verification was done through dozens of
small, purpose-built headless-browser scripts (Puppeteer) that measured
real DOM state, animation timing curves, and pixel-level output — catching
issues like a race condition between async browser scroll events and
element visibility, a stacking-context bug that silently broke color
contrast, and a missing keyboard focus indicator, all before they were
ever visible to a real user.
**Demonstrates:** a genuine testing discipline, not just "it looked right
to me" — verifying claims computationally rather than trusting them.

---

## 6. Skills & technology keyword list

**Languages:** JavaScript (ES6+), HTML5, CSS3, Node.js

**Frontend concepts:** DOM manipulation, CSS animations & transitions,
`requestAnimationFrame`, CSS custom properties (variables), responsive/
mobile-first design, CSS Grid & Flexbox, `IntersectionObserver`, event
delegation, accessibility (WCAG, ARIA, keyboard navigation, focus
management), `prefers-reduced-motion`, CSS stacking contexts & `z-index`,
`mix-blend-mode`

**Techniques & patterns:** FLIP animation technique, spring/physics-based
motion, seeded pseudo-random number generation, deterministic hashing,
debouncing/throttling for scroll & wheel events, state machines (view
routing), progressive enhancement (graceful placeholder→real-content
fallback)

**Tooling & methodology:** Node.js scripting (file I/O, binary buffer
parsing), Puppeteer (headless browser automation & testing), Git,
automated visual regression testing, performance profiling (animation
frame budgets, idle CPU verification)

**Systems/format knowledge:** binary file format parsing (PNG, JPEG headers),
static site architecture, build tooling design

**Soft/process skills:** independent debugging & root-cause analysis,
iterative design based on visual/functional review, directing and
verifying AI-assisted development, technical writing/documentation (this
spec, the project's own build documentation)

---

## 7. Quantifiable metrics bank

Use these as the "measured by" clause in bullets — all verified during
development, not estimated:

- Responsive layout verified correct across **8 breakpoints**, 320px to 1440px+
- Page-transition glyph alignment verified accurate to **0px offset** across 5 breakpoints
- **Zero idle CPU usage** (0 animation frames) confirmed when the UI is at rest
- **Dozens of automated test scripts** written and run to verify behavior, not appearance alone
- **Over a dozen distinct bugs** found and root-caused via automated testing before user impact
- Procedural layout system generates organic, non-repeating arrangements across **3 independent galleries** with zero manual coordinate placement
- FLIP animation system coordinates up to **6 simultaneously-animated elements** per interaction with guaranteed on-screen landing
- Custom image-metadata tool: **zero external dependencies**, parses 2 binary file formats from raw bytes

---

## 8. Narrative anecdotes (for cover letters / STAR-format interview answers)

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

**The match-cut transition (good for: "tell me about something you're proud of" / creative-technical roles):**
Wanted a page transition that felt like a film match-cut — not a generic
fade — where a giant wordmark on the homepage seamlessly becomes the same
wordmark shown differently on the next page. Getting this right meant the
two states had to align exactly, at every screen size, which turned into a
real measurement problem: comparing font rendering, glyph positions, and
breakpoint-specific sizing between two different DOM elements, live, and
correcting for the gap. It's the kind of detail most users would never
consciously notice, but that's exactly the point — it reads as
professional/expensive-feeling precisely because nothing calls attention
to itself.

**Choosing not to use a framework (good for: "why did you choose X approach"):**
Deliberately built this without React, Vue, or any build tooling — not out
of unfamiliarity, but because a single-photographer portfolio site didn't
need the overhead, and doing the state management, DOM updates, and
animation coordination by hand forced a much deeper understanding of what
frameworks normally abstract away (render timing, reflow/repaint costs,
event delegation). Good answer to "why didn't you just use React" if asked.

---

## 9. Do NOT claim (guardrails for the resume/cover-letter helper)

- **No backend/server exists yet.** A learning roadmap for a photo-upload
  server (Node/Express, SQLite, Linux, nginx, etc.) has been *designed* but
  not built. Do not write bullets claiming a working upload API, database,
  or deployed backend until that work is actually done.
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

## 10. Tailoring guidance by role type

**Frontend / UI engineering roles:**
Lead with the animation systems (spring physics, FLIP, match-cut
transitions), CSS depth (custom properties, blend modes, stacking
contexts), and accessibility work. This project is strongest here — it's
doing things most portfolio sites don't attempt.

**General SWE / full-stack internships:**
Lead with the debugging methodology (the race condition story), the
build-tooling work (binary file parsing, Node.js script), and the
systematic testing approach. Balances frontend polish with
"real engineering" signal.

**Design-adjacent / creative technologist / agency roles:**
Lead with the match-cut transition and the procedural layout engine —
these show design sensibility executed with real technical rigor, which is
exactly what this kind of role screens for.

**Data/backend/infra roles (once the server project is built):**
This project alone under-indexes here — pair it with the server project
bullets once real (see the conversation's earlier resume-bullet draft for
the website, and revisit once Linux/networking/API work is actually done).

**QA / DevTools / testing-focused roles:**
Lead with Section 5's "systematic QA methodology" and the specific bugs
caught — the Puppeteer-based verification approach is a genuine, unusual
signal for someone without professional QA experience.

---

## 11. Fill in before using (application-specific — not filled in here)

- School, major, expected graduation date
- Target role type(s) for this specific application
- Company/job description to tailor keyword emphasis against (cross-reference
  Section 6 against the posting's required skills — don't force-fit
  keywords that aren't genuinely represented above)
- Whether this project should be the resume's primary project or a secondary
  one alongside coursework/other experience
