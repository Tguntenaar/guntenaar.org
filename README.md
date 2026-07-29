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
`background-position` equivalent from 50% down to 70% as the veil goes, which
is what brings the water up from a sliver at the bottom edge to half the
screen. `FRAME_REST` in `water.js` and `background-position` on `.backdrop` in
`style.css` are the same number written twice — change both.

The painting is fitted to the width and never cropped sideways, because all
four houses have to stay reachable and a cover fit on a phone throws the outer
two off the edges. On a window wider than the painting is tall that leaves it
overrunning top and bottom, which is what there is to sink into; on a narrow
one it falls short, and `--surround` fills the bands above and below.

The waterline, ripple height, size and speed are the four constants at the top
of the file, in the painting's own coordinates rather than the screen's, so
they stay put however the viewport crops it.

Everything is opt-in on success. The scroll room past the roster (`.tail`) and
the plumb line hinting at it are zero-height until `water.js` has a working
WebGL context, sets `--tail` and adds `water-on` to `<html>`; without one the
page is exactly what it always was, with the still painting behind it and
nothing extra to scroll through. `404.html` gets the same backdrop minus the
canvas.

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
sunny, day, golden and two shades of night, one transparent layer per house
per scene holding just that building and its reflection, and two loose pieces
of the night: the starred sky and the lit boat. Every file is the same
1072x1008 frame as `canal.webp`, so a layer drops onto the base with no offset
and no seam. That alignment is the whole trick; nothing in the code positions
anything.

`tools/build_layover.py` encodes them to `public/layover/*.webp` — 12 MB of
PNG becomes 1.3 MB, and a house layer collapses to 10-20 KB because almost
every pixel in it is transparent. Alpha is kept lossless, because the cutout
is what aligns the house to the scene and a soft edge there reads as a halo.
Re-run it after repainting anything.

`water.js` composites, and scroll is the clock. Four scenes — `day`, `sunny`,
`golden`, `night-dark` — and the shader crossfades whichever pair you are
between, linear the whole way. The stops and the colours their bands take are
the `STOPS` array at the top of the file; adding a scene to it adds it to the
ramp and lengthens the page to fit.

The pacing is the other half of it. The day holds until the veil is spent and
the last card is off the top of the screen (`dawn()`), so the painting gets a
stretch of being nothing but itself before anything starts; then a whole
screen of scrolling per crossfade, so a scene arrives, holds and gives way
rather than flickering past. That makes the tail past the roster not somewhere
to sit and watch the water but the day going down, and it puts the page at
about four and a half screens end to end.

`SCREENS` is the pace — one screenful per crossfade, and the floor on how long
the first scene is held — and `DWELL` is how long the page goes on after night
lands. `.tail` is sized from them by `room()` rather than written in the
stylesheet, because most of the sum is the roster's own height and only
JavaScript knows that; the stops land on the same screen boundaries on a phone
as on a desktop. Raise `SCREENS` for a slower day and a longer page, lower it
for the opposite.

Two layers ride on the last crossfade alone — `nightsky`, whose stars and moon
cover over the ones `night-dark` carries, and `boat`, the tour boat with its
windows lit. Neither is a variant of anything; they are what the canal has
after dark and nothing before it. Then the hovered houses go over the top.
Everything shares the water distortion, so a lit window ripples in the
reflection along with everything around it.

Every branch is on a uniform, so each pixel in a frame takes the same one: two
texture reads while the ramp is between stops, one while it is sitting on
either end, and the night layers and unlit houses cost nothing until they are
actually on screen.

Hovering a house picks it out. Each house has two versions — `sunny` and
`night-light` — and the hovered house crossfades between them on the same
last-crossfade `dark` the night layers ride on, so pointing at a building in
daylight brings the sun out on it, pointing at one after dark turns its lights
on, and a house held through a sunset turns over with everything else. Two
versions for four scenes is a compromise: at the sunny stop there is nothing
brighter to reach for, so hovering there does very little. The two share a
silhouette to within a pixel of antialiasing, which is what lets them be mixed
as straight alpha.

The hit region is the layer's own alpha channel, read once into a quarter-scale
mask, so the art *is* the hit region and there is no second set of coordinates
to keep in step with it. Pointer devices only.

Three things worth knowing:

- **Fourteen samplers, and WebGL 1 only promises eight.** Everything current
  reports sixteen. Where it does not, `water.js` drops the sunny house halves
  first — hovering then only lights houses after dark — and below ten it drops
  the two middle scenes as well, leaving a straight day-to-night crossfade on
  eight samplers, which is the floor of the spec. Nothing else changes.
- **The scenes are fetched as they are needed.** Each is requested when the
  crossfade that ends on it begins, which is a screenful of scrolling of
  warning, and the whole dark side — the night scene, the sky, the boat and
  the four lit-window houses — is fetched as one so nothing can be caught
  halfway through a sunset. Until a scene lands the ramp waits at the last
  stop it has; scroll faster than the network and the light simply catches up.
  A visitor who never scrolls pays for the day scene only. The backdrop costs
  about 300 KB in daylight and 1.1 MB by the bottom of the page.
- **`--surround` is painted twice.** The shader owns every pixel of the
  canvas, including the bands above and below the painting; the CSS custom
  property is what shows in the moment before the canvas has a texture and
  behind the page where it overscrolls. Both come off the same `band` ramp
  over the same constants, so they cannot disagree.

Add `?dev` to the URL for a panel with an hour slider, a button per stop, a
toggle per house, and a `follow scroll` that hands the clock back to the page.
`window.layover` drives the same things from the console. It lives in
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