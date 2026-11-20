#!/bin/sh
# Rebuild the link-preview card -- public/og-canal.jpg, the image every chat app
# and search result shows when guntenaar.org is shared.
#
#     tools/make_og_image.sh                      # shoots the live site
#     tools/make_og_image.sh http://localhost:3000/
#
# The card is a screenshot of the page itself at 1200x630, so it cannot drift
# from the design: if the page changes, re-run this and the card follows.
#
# Two limits it has to respect:
#   - 1200x630 is the size Facebook, LinkedIn, Slack and WhatsApp size their
#     large cards to.
#   - WhatsApp silently drops images over ~300 KB and shows a text-only preview,
#     so the JPEG quality steps down until the file fits.
#
# If the image changes, rename it (and the og:image / twitter:image tags,
# vercel.json and public/_headers) -- every platform caches the scrape by URL
# for days, and a new filename is the only reliable way past that.
set -eu

URL="${1:-https://www.guntenaar.org/}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/public/og-canal.jpg"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# virtual-time-budget lets the scene, the crest and the water canvas finish
# loading before the shot is taken.
"$CHROME" --headless=new --disable-gpu --hide-scrollbars \
    --window-size=1200,630 --virtual-time-budget=6000 \
    --screenshot="$TMP/shot.png" "$URL" 2>/dev/null

for q in 80 76 72 68 64 60; do
    sips -s format jpeg -s formatOptions "$q" "$TMP/shot.png" --out "$OUT" >/dev/null
    size=$(stat -f %z "$OUT")
    if [ "$size" -lt 290000 ]; then
        echo "wrote $OUT (q$q, $size bytes)"
        sips -g pixelWidth -g pixelHeight "$OUT" | tail -2
        exit 0
    fi
done
echo "could not get $OUT under 290 KB" >&2
exit 1
