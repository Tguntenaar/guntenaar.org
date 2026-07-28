#!/usr/bin/env python3
"""
Draw the link-preview card — public/og.jpg, the image every chat app and search
result shows when guntenaar.org is shared.

    python3 tools/make_og_image.py

It rebuilds the page's own masthead at 1200x630: the canal watercolour under
the same eggshell veil, Archivo for the headline, IBM Plex Mono for the
eyebrow, and the four portraits the site already ships. Nothing here is a new
asset -- if the page changes, re-run this and the card follows.

The fonts are pulled from Google Fonts into tools/.fonts/ on first run rather
than committed: they are the same two families the page loads at runtime, and
600 KB of TTF in the repo to render one image is a bad trade.
"""
import os
import urllib.request
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUB = os.path.join(ROOT, "public")
FONTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".fonts")
OUT = os.path.join(PUB, "og.jpg")

# 1200x630 is the size Facebook, LinkedIn, Slack and WhatsApp all size their
# large cards to. X crops it to 2:1, so nothing that matters goes in the top or
# bottom 15 px.
W, H = 1200, 630
MARGIN = 76

SHELL = (239, 237, 233)
INK = (20, 24, 31)
MUTED = (111, 118, 129)
PAPER = (255, 255, 255)

# The page veils the painting at 0.9 so the type stays the thing you read. A
# card is looked at, not read, and at thumbnail size 0.9 washes the canal out
# to nothing -- so the veil lifts a little here and the picture survives.
VEIL = 0.82

FACES = ["joost", "boris", "thomas", "olivier"]
NAMES = ["Joost", "Boris", "Thomas", "Olivier"]

# The Google Fonts CSS API hands back a different URL per weight; these are the
# static instances of the same families in index.html.
FONT_URLS = {
    "archivo-bold.ttf": "https://fonts.gstatic.com/s/archivo/v25/k3k6o8UDI-1M0wl"
    "SV9XAw6lQkqWY8Q82sJaRE-NWIDdgffTT0zRp8A.ttf",
    "archivo-regular.ttf": "https://fonts.gstatic.com/s/archivo/v25/k3k6o8UDI-1M0wl"
    "SV9XAw6lQkqWY8Q82sJaRE-NWIDdgffTTNDNp8A.ttf",
    "plexmono-regular.ttf": "https://fonts.gstatic.com/s/ibmplexmono/v20/"
    "-F63fjptAgt5VM-kVkqdyU8n5ig.ttf",
}


def font(name, size):
    os.makedirs(FONTS, exist_ok=True)
    path = os.path.join(FONTS, name)
    if not os.path.exists(path):
        req = urllib.request.Request(
            FONT_URLS[name], headers={"User-Agent": "Mozilla/5.0"}
        )
        with urllib.request.urlopen(req) as r, open(path, "wb") as f:
            f.write(r.read())
        print(f"fetched {name}")
    return ImageFont.truetype(path, size)


def ground():
    """The canal, cover-cropped and veiled — the page's own background."""
    canal = Image.open(os.path.join(PUB, "canal.webp")).convert("RGB")
    cw, ch = canal.size

    # Cover: scale to fill, then crop. The page holds the frame at 38% from the
    # top to keep the rooflines and the waterline both in shot; a 1200x630 card
    # is far wider than the near-square painting, so that matters more here.
    scale = max(W / cw, H / ch)
    canal = canal.resize((round(cw * scale), round(ch * scale)), Image.LANCZOS)
    left = (canal.width - W) // 2
    top = max(0, min(canal.height - H, round(canal.height * 0.38 - H / 2)))
    canal = canal.crop((left, top, left + W, top + H))

    # The page's veil is a vertical gradient, heavier at the top where the
    # headline sits. Same idea, one row at a time.
    veil = Image.new("RGB", (W, H), SHELL)
    mask = Image.new("L", (1, H))
    for y in range(H):
        t = y / (H - 1)
        a = VEIL + 0.06 - 0.12 * t
        mask.putpixel((0, y), round(max(0.0, min(1.0, a)) * 255))
    return Image.composite(veil, canal, mask.resize((W, H)))


def circle(img, size):
    """Square portrait -> circle with a paper ring, the way the page frames it."""
    ring = 6
    outer = size + ring * 2
    face = img.convert("RGB").resize((size, size), Image.LANCZOS)

    # 4x supersampled mask: a hard-edged circle at this diameter shows its
    # stair-steps against the flat ground.
    m = Image.new("L", (outer * 4, outer * 4), 0)
    ImageDraw.Draw(m).ellipse((0, 0, outer * 4 - 1, outer * 4 - 1), fill=255)
    m = m.resize((outer, outer), Image.LANCZOS)

    out = Image.new("RGB", (outer, outer), PAPER)
    out.paste(face, (ring, ring), circle_mask(size))
    return out, m


def circle_mask(size):
    m = Image.new("L", (size * 4, size * 4), 0)
    ImageDraw.Draw(m).ellipse((0, 0, size * 4 - 1, size * 4 - 1), fill=255)
    return m.resize((size, size), Image.LANCZOS)


def main():
    card = ground()
    d = ImageDraw.Draw(card)

    eyebrow = font("plexmono-regular.ttf", 25)
    headline = font("archivo-bold.ttf", 92)
    lede = font("archivo-regular.ttf", 31)
    caption = font("plexmono-regular.ttf", 22)

    # Eyebrow, letterspaced by hand — PIL has no tracking.
    x, y = MARGIN, MARGIN
    for ch in "guntenaar.org":
        d.text((x, y), ch, font=eyebrow, fill=MUTED)
        x += d.textlength(ch, font=eyebrow) + 2.6

    d.text((MARGIN, y + 58), "Four Guntenaars.", font=headline, fill=INK)
    d.text(
        (MARGIN, y + 176),
        "A photographer, an accountant with a drone company,",
        font=lede,
        fill=MUTED,
    )
    d.text((MARGIN, y + 216), "and two engineers.", font=lede, fill=MUTED)

    # The four of them along the bottom, evenly spaced across the text column.
    size, gap = 132, 44
    top = H - MARGIN - size - 46
    for i, (slug, name) in enumerate(zip(FACES, NAMES)):
        face = Image.open(os.path.join(PUB, "portraits", f"{slug}.webp"))
        disc, mask = circle(face, size)
        left = MARGIN + i * (size + gap)
        card.paste(disc, (left - 6, top - 6), mask)

        w = d.textlength(name, font=caption)
        d.text((left + size / 2 - w / 2, top + size + 18), name, font=caption, fill=INK)

    card.save(OUT, "JPEG", quality=90, optimize=True, progressive=True)
    print(f"{OUT} -> {os.path.getsize(OUT) / 1024:.0f} KB")


if __name__ == "__main__":
    main()
