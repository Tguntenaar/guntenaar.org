#!/usr/bin/env python3
"""
Encode the painted layover art for the web.

    python3 tools/build_layover.py

`layover/` holds the painted source: whole-scene versions of the canal at
different times of day, and one transparent layer per house per scene holding
just that building and its reflection. They are 1072x1008 PNGs, the same frame
as `public/canal.webp`, so every layer composites straight onto the base with
no offset -- which is what lets the shader stack them.

As PNGs they come to about 15 MB. As WebP they come to about a tenth of that,
and the house layers collapse to 10-20 KB each because almost every pixel in
them is transparent.

Alpha is encoded losslessly (`alpha_quality=100`); the cutouts are what aligns
a house with the scene under it, and a soft edge there shows as a halo.

The day base is deliberately absent: that is `public/canal.webp`, which the
page already loads as the CSS background and the still fallback. Encoding it
twice would mean two 240 KB files of the same picture.
"""
import os

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "layover")
OUT = os.path.join(ROOT, "public", "layover")

# 80 holds the watercolour's paper grain, which is most of what the picture is;
# below about 72 the wash starts to band in the sky.
QUALITY = 80

SKIP = {
    # The day scene, already shipped as public/canal.webp.
    "day.png",
}


def main():
    os.makedirs(OUT, exist_ok=True)
    total_in = total_out = 0

    for name in sorted(os.listdir(SRC)):
        if not name.endswith(".png") or name in SKIP:
            continue

        src = os.path.join(SRC, name)
        dst = os.path.join(OUT, name[:-4] + ".webp")
        im = Image.open(src)

        # Only the house layers and the sky need an alpha channel; the
        # whole-scene versions are opaque, and keeping them RGB saves the
        # encoder from writing an all-255 alpha plane.
        has_alpha = "A" in im.getbands() and im.getchannel("A").getextrema()[0] < 255
        im = im.convert("RGBA" if has_alpha else "RGB")
        im.save(dst, "WEBP", quality=QUALITY, method=6, alpha_quality=100)

        a, b = os.path.getsize(src), os.path.getsize(dst)
        total_in, total_out = total_in + a, total_out + b
        print(f"{name:30s} {a / 1024:7.0f} KB -> {b / 1024:6.0f} KB"
              f"{'  (alpha)' if has_alpha else ''}")

    print(f"\n{'total':30s} {total_in / 1024:7.0f} KB -> {total_out / 1024:6.0f} KB")


if __name__ == "__main__":
    main()
