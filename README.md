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
  canal.webp      the Amsterdam watercolour behind everything
  og.jpg          the 1200x630 link-preview card, generated
  robots.txt      allow everything, point at the sitemap
  sitemap.xml     one URL — edit lastmod when the page changes
  _headers        caching + security headers, if ever served by Cloudflare
  favicon.svg
  portraits/      face-cropped 400x400 WebP, ~14 KB each
originals/        the full-resolution source photos — keep these
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
