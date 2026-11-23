# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Hiring managers and engineers** reviewing Libby's work during job applications. They visit to judge front-end engineering and design craft.
- **Friends and family** who want to see where Libby has been and the photos from those trips.
- **People who enjoy travel photography**, and possibly future photography clients.

## Product Purpose

libbyli.me is Libby Li's personal travel photography portfolio. The home page is a realistic landscape of a sloping field under a blue sky, with hazy mountains and clouds: the words "photos", "illustrations" and "about me" stand on the crest of a field and hop up when hovered. "photos" opens the globe page, where a 3D globe marks the places she has photographed. Clicking a pin opens that place's photos directly: the pin's photo grows into the full-size viewer. A separate photos view lists the places by month and year and previews each one's photos.

The main goal is for visitors to leave impressed by the build: the globe, the transitions and the interactions are evidence of engineering and design skill. The photos are the content that this craft serves.

## Positioning

The site is built by its owner, as a working demonstration of what she can engineer. The interactions are the claim, so they have to work flawlessly in a real browser, not just look good in a mock-up.

## Operating Context

- Live at libbyli.me. The photo-upload page and API ("Darkroom") are at upload.libbyli.me.
- Photos reach the site two ways: image files in `photos/` compiled by `node build-photos.mjs` into `photos-data.js`, and galleries uploaded through Darkroom, which the site fetches at load time.
- Globe pins come from `places.js`. Keys there match gallery titles, and a gallery without an entry still appears in the photo list without a pin.
- `resume-project-spec.md` is a factual record of the project, used to write resume bullets and interview talking points. Claims about the site there must stay true.

## Capabilities and Constraints

- Static pages served on GitHub Pages with a custom domain: `index.html` (the hillside home page: `hill.js` paints the sky, clouds, mountains and field with a WebGL shader, once per resize, with a plain-gradient fallback without WebGL; `hill.css` sets the layers and type), `photos.html` (the globe and photos; Tailwind via CDN, Three.js via an importmap, d3 and topojson for the land mask), and `illustrations.html` and `about.html` (coming-soon placeholders on the same hillside). `firefly.js` draws the firefly cursor on every page.
- The owner has confirmed that all of the following may change when there's a reason: the single-file structure, GitHub Pages hosting, the photo pipelines (build script, Darkroom, `places.js`), and the no-framework approach. Keep the libbyli.me domain.
- The globe's relief comes from Mapzen/Terrarium elevation tiles. (The zoomed-in satellite landscape view was removed at the owner's request on 2026-11-18, so Esri imagery is no longer used.)
- Local development: `node serve.mjs` serves the site at http://localhost:3000. `node screenshot.mjs <url> [label]` saves Puppeteer screenshots to `temporary screenshots/`.

## Brand Commitments

- Name: Libby Li. The wordmark reads "libbyli.jpg".
- The owner set the direction for the current redesign: a 3D globe hero; frosted and ombre accents; a soft, relaxing, muted nature feel; a low-poly globe. (The realistic zoomed-in terrain view was later dropped in favour of opening the photos straight from a pin.) She also asked for a firefly cursor, a three-dot menu and a globe hero with no text. On 2026-11-22 she added the hillside home page in front of it: an open slanted field with the section words standing on the horizon, a blend of a misty valley photo and a sunny illustrated hillside. Later that day she asked for it to look realistic, like two landscape photos she supplied (a hazy golden-hour valley and a blue sky over a sloping green field), with the words much smaller and off centre; they now sit small in the right third of the horizon.

## Evidence on Hand

- Real photos in `photos/` and on Darkroom. The current galleries are Banff, Alberta and China (Spring 2026).
- The China pin is a placeholder near Lake Tai (Suzhou), not a confirmed location.
- There are no testimonials, clients, press or photography credits. Don't invent any.
- There are no illustrations or about-me text yet; those pages are placeholders until Libby provides content. Don't write either for her.

## Product Principles

1. **The craft is the pitch.** Every interaction should hold up for an engineer who looks closely: smooth, exact, no rough edges.
2. **Photos are the payload.** The globe and the motion lead people to the pictures, and must never bury them.
3. **Honest claims only.** Anything the site, or the resume spec about it, says has to be true and verifiable.
4. **Easy to keep fresh.** Adding a trip, its photos and its pin should stay a simple routine for the owner.

## Accessibility & Inclusion

No product-specific standard has been set. The current site respects reduced-motion preferences, provides keyboard focus states and lets touch devices preview photos by tapping.
