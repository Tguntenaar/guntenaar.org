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

  const output = document.createElement("canvas");
  output.className = "hexfloat-output";

  content.setAttribute("data-canvasui-content", "");
  source.appendChild(content);
  stage.append(source, output);
  parent.insertBefore(stage, anchor);

  const instance = createHexFloat(
    { source, content, output },
    {
      // Tuned well below the library's defaults. The page is a white index
      // whose job is legibility; the tiles should read as a surface the names
      // rest on, not as the subject.
      size: 190,
      tilt: 16,
      perspective: 0.35,
      float: 0.14,
      speed: 0.55,
      shine: 0.3,
      lift: 0.14,
      radius: 1000,
      flow: 0.9,
      swirl: 3,
      trail: 0.25,
      iridescence: 0.35,
      bloom: 0,
      grain: 0.2,
    },
  );

  if (!instance) {
    // WebGL2 context creation can still fail after the probe. Put the page
    // back exactly where it was rather than leave it stranded in a canvas.
    content.removeAttribute("data-canvasui-content");
    parent.insertBefore(content, anchor);
    stage.remove();
    anchor.remove();
    return;
  }

  anchor.remove();
  document.documentElement.classList.add("hexfloat-on");
  window.addEventListener("resize", () => instance.resize(), { passive: true });
}
