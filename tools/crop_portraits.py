#!/usr/bin/env python3
"""
Crop the family photos to face-centred squares and export the site's WebPs.

    python3 tools/crop_portraits.py

The originals are full-resolution photos (up to 1.2 MB, 3024x4032). The page
shows them at 68 px, so shipping the originals would mean ~4 MB of payload for
a few hundred pixels of picture -- on a page whose whole job is to be fast on a
phone. These come out around 14 KB each.

To reframe someone, change their entry below and re-run:

    focus  face centre, as a fraction of (width, height)
    zoom   side of the crop square, as a fraction of the shorter edge
"""
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "originals")
OUT = os.path.join(ROOT, "public", "portraits")
SIZE = 400  # ~4x the largest display size, so it stays sharp on dense screens

PEOPLE = {
    # A group shot -- Joost is the middle of three, sitting right of centre.
    # Pulled in tight enough that the two sons either side fall out of frame;
    # at 68 px they would otherwise read as clutter, not company.
    "joost":   {"file": "joost.jpeg",  "focus": (0.548, 0.458), "zoom": 0.74},

    # Boris's own site portrait, already square and shot on stage. He sits
    # right of centre and high in the frame, so the crop follows him up.
    "boris":   {"file": "boris.jpeg",  "focus": (0.520, 0.320), "zoom": 0.63},

    "thomas":  {"file": "thomas.jpeg", "focus": (0.508, 0.381), "zoom": 1.00},
    "olivier": {"file": "olivier.jpeg", "focus": (0.514, 0.398), "zoom": 1.00},
}


def crop_square(path, focus, zoom):
    img = Image.open(path).convert("RGB")
    w, h = img.size
    side = int(min(w, h) * zoom)

    # Centre on the face, then clamp so the square stays inside the frame.
    cx, cy = focus[0] * w, focus[1] * h
    left = max(0, min(w - side, int(cx - side / 2)))
    top = max(0, min(h - side, int(cy - side / 2)))

    return img.crop((left, top, left + side, top + side)).resize(
        (SIZE, SIZE), Image.LANCZOS
    )


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, cfg in PEOPLE.items():
        src = os.path.join(SRC, cfg["file"])
        dst = os.path.join(OUT, f"{name}.webp")
        crop_square(src, cfg["focus"], cfg["zoom"]).save(
            dst, "WEBP", quality=86, method=6
        )
        print(
            f"{name:9s} {os.path.getsize(src) / 1024:7.0f} KB"
            f" -> {os.path.getsize(dst) / 1024:5.1f} KB"
        )


if __name__ == "__main__":
    main()
