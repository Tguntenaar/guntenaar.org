# guntenaar.org

A family index: four Guntenaars and where to find each of them.

## What this is

A single static page. No framework, no build step — `public/` is the site.
It was a Vue + Vite + Tailwind app; for four names and six links that was more
machinery than content, so it is plain HTML and CSS now.

```
public/
  index.html      the page
  404.html        not-found, same design
  style.css       all of it
  analytics.js    PostHog
  secret.js       the hidden geforcy.com link
  water.js        the canal moving, and the backdrop compositor
  layover-dev.js  hand controls for the backdrop, loaded only by ?dev
  canal.webp      the Amsterdam watercolour behind everything — the day scene
  layover/        the other painted scenes and the per-house light layers
  og.jpg          the 1200x630 link-preview card, generated
  robots.txt      allow everything, point at the sitemap
  sitemap.xml     one URL — edit lastmod when the page changes
  _headers        caching + security headers, if ever served by Cloudflare
  favicon.svg
  portraits/      face-cropped 400x400 WebP, ~14 KB each
originals/        the full-resolution source photos — keep these
layover/          the painted source PNGs, 12 MB — keep these
vercel.json       build + header config for the live host
```

## Working on it

There is nothing to install.

```sh
cd public && python3 -m http.server 8765
```

### Portraits

`public/portraits/*.webp` are generated from `originals/*.jpeg` — face-centred
square crops, resized to 400 px and encoded as WebP. The originals are 1 MB+
phone photos and the page renders them at 68 px, so they are not shipped
directly. To reframe one, adjust its `focus` (face centre, as a fraction of
width and height) and `zoom` (square side, as a fraction of the shorter edge)
in `tools/crop_portraits.py` and re-run it.

### The link-preview card

`public/og.jpg` is what chat apps and search results show when the site is
shared. It is drawn by `tools/make_og_image.py` from the assets the page
already has — the watercolour, the portraits, the same two fonts — so a change
to the page can be carried over by re-running it:

```sh
python3 tools/make_og_image.py
```

The fonts come from Google Fonts into `tools/.fonts/` on first run and are not
committed.

Scrapers cache preview images hard and mostly ignore `Cache-Control`, so after
replacing it, re-scrape by hand where it matters — Facebook's Sharing
Debugger, LinkedIn's Post Inspector. WhatsApp and iMessage follow whatever
Facebook has cached.

### The hidden link

`public/secret.js` keeps any `[data-secret]` destination out of the page — out
of the tab order and the accessibility tree, not merely invisible — until that
row's portrait is clicked three times. Currently just Thomas's `geforcy.com`.
Once found it stays found, in `localStorage`.

### The water

Scroll and the eggshell veil thins off the watercolour, which sinks to frame
its own reflection; by the time the last card leaves the top of the screen the
veil has gone entirely and the canal is moving.

The painting already contains the reflection — it is a mirror in the original.
`public/water.js` only bends the pixels below the waterline with a couple of
sine waves, on a fixed full-viewport canvas sitting directly on top of the CSS
background in `.backdrop`. The two are framed identically at rest, so the
canvas fading in is invisible; from there the shader slides its
`background-position` equivalent from 38% down to 70% as the veil goes, which
is what brings the water up from a sliver at the bottom edge to half the
screen. `FRAME_REST` in `water.js` and `background-position` on `.backdrop` in
`style.css` are the same number written twice — change both.

The waterline, ripple height, size and speed are the four constants at the top
of the file, in the painting's own coordinates rather than the screen's, so
they stay put however the viewport crops it.

Everything is opt-in on success. The scroll room past the roster (`.tail`) and
the plumb line hinting at it are zero-height until `water.js` has a working
WebGL context and adds `water-on` to `<html>`; without one the page is exactly
what it always was, with the still painting behind it and nothing extra to
scroll through. `404.html` gets the same backdrop minus the canvas.

The reveal is linear from the very first pixel of scroll and complete when the
bottom of the roster reaches the top of the screen, so the painting is arriving
the whole time the cards are on their way out. Two knobs go with that, both in
`style.css`: `--veil` is how much eggshell sits over the painting at rest, and
`--muted-lift` darkens the domains and captions toward the ink at the same rate
the veil thins. Without the second one the links — the only part of the page
that does anything — wash out against the watercolour halfway down. Drop it and
you get a softer page; raise `--veil` and you get the old, quieter one.

The render loop only runs while the water has movement left in it, so sitting
at the top of the page costs nothing, and `prefers-reduced-motion` still
reveals the painting but holds it still.

### The layover

`layover/` holds the canal painted several times over — the whole scene at
sunny, day, golden and two shades of night, and one transparent layer per
house per scene, holding just that building and its reflection. Every file is the same
1072x1008 frame as `canal.webp`, so a layer drops onto the base with no offset
and no seam. That alignment is the whole trick; nothing in the code positions
anything.

`tools/build_layover.py` encodes them to `public/layover/*.webp` — 12 MB of
PNG becomes 1.3 MB, and a house layer collapses to 10-20 KB because almost
every pixel in it is transparent. Alpha is kept lossless, because the cutout
is what aligns the house to the scene and a soft edge there reads as a halo.
Re-run it after repainting anything.

`water.js` composites: it crossfades the base between day and night, then
blends the hovered houses over it, all of them sharing the water distortion —
so a lit window ripples in the reflection along with everything around it. The
branches are on uniforms, so with nothing hovered and the scene not
mid-crossfade nine of the ten samplers go untouched and the idle cost is one
texture read.

Hovering a house picks it out. Each house has two versions — `sunny` and
`night-light` — and the hovered house crossfades between them on the same
`dark` that drives the scene behind it, so pointing at a building in daylight
brings the sun out on it, pointing at one after dark turns its lights on, and
a house held through a sunset turns over with everything else. The two share a
silhouette to within a pixel of antialiasing, which is what lets them be mixed
as straight alpha.

The hit region is the layer's own alpha channel, read once into a quarter-scale
mask, so the art *is* the hit region and there is no second set of coordinates
to keep in step with it. Pointer devices only.

Two things worth knowing:

- **Ten samplers, and WebGL 1 only promises eight.** Everything current
  reports sixteen. Where it does not, `water.js` drops the sunny halves and
  generates a six-sampler shader instead, in which hovering only lights houses
  after dark. Nothing else changes.
- **The page is still day-only.** Nothing turns the scene dark yet, so
  nothing on the dark side is prefetched — the night base and the four
  lit-window layers are fetched together by `nightfall()` the first time
  `setNight` is called, and `dark` cannot start rising until all of them have
  landed. One version of each house *is* prefetched (57 KB), because its alpha
  is what the pointer is tested against and in daylight it is also the one
  that shows. The backdrop costs about 300 KB in daylight, 540 KB once the
  page starts going dark.

Add `?dev` to the URL for a panel with a night slider and a toggle per house,
plus `window.layover` to drive the same things from the console. It lives in
`layover-dev.js`, which a page without `?dev` never fetches — the finished
page has no controls.

## Analytics

PostHog, project 531417 on US cloud, in `public/analytics.js`. The `phc_` key
is a public write-only project key, so it lives in the repo rather than in an
environment variable; the site has no build step to inject one with.

## Hosting

**Vercel**, deployed from this repo on every push to `main`. No GitHub Actions
workflow and no deploy secrets.

`vercel.json` is what makes that work, and it has to exist: the Vercel project
predates the rewrite and still has *Framework Preset: Vite* saved in its
dashboard. With the Vue toolchain gone there is no `vite` binary, so every
build died on `vite: command not found` until the repo started overriding
those settings itself.

| Setting          | Value    |
| ---------------- | -------- |
| Framework        | *(none)* |
| Build command    | *(none)* |
| Output directory | `public` |

DNS is at dds.nl, not Vercel. The apex `A` record points at `216.198.79.1`
(Vercel), and `www` is a CNAME to Vercel.

**`www.guntenaar.org` is the canonical hostname.** The apex 308s to it, which
is the Vercel project's own domain setting. The `<link rel="canonical">`, the
`og:` URLs and `sitemap.xml` all name `www` to match; if that redirect is ever
flipped to point the other way, those three have to be flipped with it or the
site will be telling search engines to index a URL that only redirects. Joost's photography site lives on at
`joost.guntenaar.org`; it and the apex are separate Vercel projects, so a
hostname assigned to the wrong one silently serves the wrong site.

`public/_headers` is Cloudflare syntax and Vercel ignores it. The same rules
are duplicated in `vercel.json`; change both or drop the one you do not use.


`cd public && python3 -m http.server 8799`