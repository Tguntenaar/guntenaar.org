# Wider canal artwork

Generated using the built-in image generation tool on 2026-11-05.

- `day.png`: horizontal outpainting, using `public/extended/day.webp` and
  `public/canal.webp` as references.
- `sunny.png`, `golden.png`, `evening.png`, `night.png`: lighting edits of
  `day.png`, each using the corresponding original `public/layover/` scene
  as its color reference.
- `*-prompt.txt`: exact prompts for those five images.
- `../../public/panorama/*.webp`: quality-90 WebP exports, without resizing.

The site preserves the original artwork in the center, so the interactive
house coordinates and lighting layers remain exact. Runtime registration of
the generated artwork is in `public/scene-texture.js` and the daylight CSS
fallback in `public/style.css`. The generated center is approximately 46.2%
of the source painting's size, offset 400px right and 447px down in the new
day artwork; the compositor accounts for that change before blending it.
