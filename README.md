# guntenaar.org

A family index: four illustrated Guntenaars above their Amsterdam canal houses.
Plain HTML, CSS and JavaScript; `public/` is the site, with no build step.

## Working on it

```sh
python3 -m http.server 8765 --directory public
```

`index.html` holds the people and destinations. `style.css` defines the shared
scene frame, paper labels and responsive layout. `houses.js` enhances native
`details` elements with hover, one open panel at a time, Escape to dismiss,
and tap/keyboard pinning. Enter or Space opens a house; Tab reaches its links.
Native disclosures still work if JavaScript is unavailable.

The `data-house` values connect the controls to the lighting layers: Joost 2,
Boris 1, Thomas 4, Olivier 3. Each person's inline coordinates are percentages
of the original 1072×1008 painting. The portraits sit immediately above the
rooflines and appear only when a house is open or its control has keyboard
focus. Small ink markers above the four roofs identify the interactive houses.
On page load, the portraits introduce Joost, Boris, Thomas and Olivier in that
order, showing each for 1.25 seconds with a short gap. This introduction never
opens the website panels and stops as soon as the visitor interacts or scrolls.
It waits for portrait images and fonts, skips reduced motion, and does not loop.
The introductory lighting does not count toward discovering all four houses.
Boris is raised on narrow screens so his portrait clears Thomas's.
Details appear below the house on desktop, or in a shared bottom position on
phones. Only one panel opens at a time, with all original destinations retained.

## Portraits

- `originals/*.jpeg`: original photographs; preserve them.
- `public/portraits/*.webp`: original photo crops, retained for structured data
  and the existing social preview.
- `originals/illustrated/*.png`: full-resolution, transparent ink-and-watercolour
  portraits generated from each photograph with `public/canal.webp` as the
  drawing-style reference.
- `public/portraits/*-drawn.webp`: the 400×400 transparent portraits used on the
  page (about 160 KB total).

To re-encode an illustrated source with ImageMagick:

```sh
magick originals/illustrated/joost.png -resize 400x400 -quality 87 \
  -define webp:alpha-quality=100 public/portraits/joost-drawn.webp
```

`tools/crop_portraits.py` still produces the original photo crops.
`tools/make_og_image.py` produces the existing photographic social preview;
it is independent of the new on-page portrait artwork.

## Family crest

The Canal House coat of arms sits in the top-left corner and stays in place
while scrolling, with smaller sizes on phones. Its 480px transparent asset is
`public/heraldry/canal-house-mark.webp`, exported from
`originals/heraldry/02-canal-house.png`.

The three original crest concepts and their generation prompts are saved in
`originals/heraldry/`. `heraldry-preview.html` compares the concepts and is
excluded from search indexing.

## The canal and the day

`water.js` preserves the existing painted scenes and WebGL water effect.
The scene progresses through day, sunny, golden, evening and night as the
visitor scrolls. The homepage has no main card; portraits appear on interaction
after the brief introduction. The bottom hint reads “scroll ↓”.
A short initial scroll fades the veil and introduces the ripples, followed by
one screen per crossfade and a brief hold at night.

CSS owns `--scene-width`, `--scene-height`, `--frame-left` and `--frame-top`.
The original scene is at most one viewport-height wide. Desktop screens show
the canal and its reflections, with newly painted houses filling the sides
instead of zooming into the original. Portrait screens keep the extra sky
and water above and below.
The background, house controls and drone all use those variables. The shader
reads the roster rectangle to use exactly the same frame. This keeps every
portrait attached to its house during resizing and scrolling.

Opening a house dispatches `housechange`; `water.js` lights the corresponding
facade, and Boris's drone follows the pointer. Scene textures load as needed.
The GPU fallback retains fewer scenes on devices with fewer texture units.
Without WebGL the still painting and all house disclosures remain usable;
`prefers-reduced-motion` keeps the water still and moves the drone immediately.

`originals/extended/*.png` contains the vertically outpainted scenes, with
new sky above and open water below. `public/extended/*.webp` ships them at
1072×3024. `originals/panorama/` contains five horizontally extended scenes
and their exact generation prompts, made with the built-in image generation
tool. `public/panorama/*.webp` contains their web exports (about 1.8 MB total).

`scene-texture.js` builds each scene texture once when it loads. The original
occupies the central cell of a 3×3 canvas, with its vertical extension behind
it and the registered panoramic drawing filling the sides. Soft masks blend
the boundaries. The house artwork and its coordinates are preserved. Texture
resolution is capped to the initial rendered frame and device pixel density
to limit memory on phones. This uses the same number of texture units as
before; extension images load alongside their scene rather than all at page
load. The shader ripples the new water as well, and blends the overlay edges.
The CSS still fallback uses the same three daylight layers.

`layover/` contains painted source PNGs; `tools/build_layover.py` creates the
WebP scene and lighting layers in `public/layover/`. All layers share the same
1072×1008 frame. Preserve the alignment when updating the art.

Add `?dev` to load `layover-dev.js` and its hour/house controls.

## Hidden link

Click Thomas's portrait three times to reveal `geforcy.com`. `secret.js` keeps
that link out of the accessibility tree and tab order until discovery, then
remembers it in local storage. The illustration carries the original photo's
storage identifier, so previous discoveries survive the redesign.

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
