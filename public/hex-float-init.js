/*
 * Canvas UI "Hex Float" — strictly a progressive enhancement.
 *
 * The effect works by hosting the real page inside a <canvas layoutsubtree>
 * and painting it back out through a WebGL shader. That only works where the
 * experimental HTML-in-canvas API exists (Chrome/Edge 140+ behind
 * chrome://flags/#canvas-draw-element, or an origin trial token). Everywhere
 * else — every iOS browser, Firefox, and stock Chrome — children of a <canvas>
 * are inert fallback content that never renders, so moving the page in there
 * unconditionally would hand most visitors a blank screen.
 *
 * Hence: prove the browser can paint it back out *first*, move the content
 * second, and put it back if setup fails anyway.
 */
import { createHexFloat, supportsHtmlInCanvas } from "./hex-float.js";

const page = document.querySelector(".page");
if (page) enhance(page);

function webgl2Available() {
  try {
    return Boolean(document.createElement("canvas").getContext("webgl2"));
  } catch {
    return false;
  }
}

function enhance(content) {
  if (!supportsHtmlInCanvas()) return;
  if (!webgl2Available()) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const parent = content.parentNode;
  const anchor = document.createComment("hexfloat-anchor");
  parent.insertBefore(anchor, content);

  const stage = document.createElement("div");
  stage.className = "hexfloat-stage";

  const source = document.createElement("canvas");
  source.className = "hexfloat-source";
  source.setAttribute("layoutsubtree", "");

  // The captured element has to be a full-size scrollable box, not the page
  // container itself — that one is max-width'd and centred, and the shader
  // needs something that fills the canvas to sample.
  const host = document.createElement("div");
  host.className = "hexfloat-content";
  host.setAttribute("data-canvasui-content", "");

  const output = document.createElement("canvas");
  output.className = "hexfloat-output";

  host.appendChild(content);
  source.appendChild(host);
  stage.append(source, output);
  parent.insertBefore(stage, anchor);

  const instance = createHexFloat(
    { source, content: host, output },
    {
      // Tuned well below the library's defaults. The page is a white index
      // whose job is legibility; the tiles should read as a surface the names
      // rest on, not as the subject.
      size: 190,
      // The dark bars are tile walls, not seams: the shader builds them as
      // seam * mix(0.55, 1) * ambientOcclusion, so no seam colour alone can
      // lift them all the way. Flattening the lean and the rise shows less
      // wall in the first place, which is what actually calms the edges.
      // The lean is the point of the effect — flattening it to 6 had thrown
      // away the sense of the page as a surface receding. Back up, with the
      // rise and the shine kept low so the tilt reads as angle rather than as
      // shaded walls.
      tilt: 14,
      perspective: 0.32,
      float: 0.07,
      speed: 0.3,
      shine: 0.14,
      lift: 0.05,
      radius: 1150,
      // Calm rather than eager. `flow` and `swirl` are what make the window
      // chase the cursor, so both come right down; `trail` is raised so it
      // lingers and settles instead of snapping shut behind you.
      flow: 0.3,
      swirl: 1,
      trail: 0.62,
      iridescence: 0.25,
      bloom: 0,
      grain: 0.2,
      // "auto" multiplies the page background by 0.55, which on a light page
      // lands near #8c8c8c and reads as hard dark bars. Pinned just under the
      // eggshell ground (--shell, #f5f1e7) instead, and warm to match it — a
      // cool grey seam over a warm page looks like dirt.
      gapColor: [0.952, 0.937, 0.898],
    },
  );

  if (!instance) {
    // WebGL2 context creation can still fail after the probe. Put the page
    // back exactly where it was rather than leave it stranded in a canvas.
    parent.insertBefore(content, anchor);
    stage.remove();
    anchor.remove();
    return;
  }

  anchor.remove();
  document.documentElement.classList.add("hexfloat-on");
  window.addEventListener("resize", () => instance.resize(), { passive: true });
}
