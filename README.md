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
  _headers        Cloudflare Pages caching + security headers
  favicon.svg
  portraits/      face-cropped 400x400 WebP, ~14 KB each
originals/        the full-resolution source photos — keep these
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

## The Hex Float effect

`public/hex-float.js` is [Canvas UI](https://canvasui.dev)'s Hex Float, vanilla
build, compiled to a plain ES module so the site keeps its no-build-step
property. It is wired up by `public/hex-float-init.js`.

**It is off for almost everyone, by design.** The effect hosts the live page
inside a `<canvas layoutsubtree>` and repaints it through a WebGL shader, which
needs the experimental HTML-in-canvas API — Chrome/Edge 140+ with
`chrome://flags/#canvas-draw-element`, or a production origin trial token.
Everywhere else, including every iOS browser, children of a `<canvas>` are
inert fallback content that never renders. So the init script proves the
browser can paint the subtree back out *before* it moves anything, and puts the
page back if setup fails anyway. Without support you get the plain page.

To regenerate the library after an upstream release:

```sh
curl -s https://canvasui.dev/r/hex-float-vanilla.json \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["files"][0]["content"])' \
  > /tmp/HexFloatVanilla.ts
npx esbuild /tmp/HexFloatVanilla.ts --bundle --format=esm --target=es2020 \
  --minify --outfile=public/hex-float.js
```

## Hosting

Cloudflare Pages, deployed from this repo via Cloudflare's Git integration —
no GitHub Actions workflow and no deploy secrets.

| Setting          | Value    |
| ---------------- | -------- |
| Build command    | *(none)* |
| Output directory | `public` |

Note that the `guntenaar.org` apex currently serves Joost's photography site
from a separate host (nginx at dds.nl), and the domain's nameservers are not
Cloudflare's. Pointing the apex here is a deliberate DNS change, not something
that follows from deploying.
