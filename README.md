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
