/* ==========================================================================
   water.js — the canal moves once the roster is out of the way

   The painting already contains its own reflection; the canal in it is a
   mirror. Nothing here draws water. It bends the pixels below the waterline
   with a couple of sine waves, which is all it takes to read as moving water.

   It renders onto a fixed, full-viewport canvas sitting directly on top of
   .backdrop's CSS background, framed to match it exactly — so the moment the
   texture is uploaded and the canvas fades in, nothing appears to change.

   Everything is opt-in on success: the tail, the plumb line and the canvas
   itself stay inert until `water-on` lands on <html>. A browser without WebGL
   gets the page exactly as it was, with no empty scroll room below it.
   ========================================================================== */

const SRC = 'canal.webp';

/* Tuning, all in the painting's own coordinates: 0 is its top edge, 1 its
   bottom. The waterline sits just under the boats, where the mirrored
   buildings begin — start it any higher and the hulls wobble like jelly. */
const WATERLINE = 0.55;
const HEIGHT    = 0.010;   // furthest a pixel is pushed sideways
const SIZE      = 1.36;    // ripple frequency; lower is wider
const SPEED     = 0.85;

/* How the painting is framed vertically, in the units background-position
   takes. It sinks toward the water as the veil lifts: at rest the rooflines
   are the subject, fully revealed the reflection is. REST must stay in step
   with .backdrop's `background-position` or the canvas would pop when it
   fades in. */
const FRAME_REST   = 0.38;
const FRAME_REVEAL = 0.70;

const cvs    = document.getElementById('water');
const roster = document.querySelector('.roster');
const root   = document.documentElement;
const calm = matchMedia('(prefers-reduced-motion: reduce)');

let gl, U, tex;
let imgW = 1072, imgH = 1008;
let ready = false;
let reveal = 0;   // 0 while the cards are on screen, 1 once they are gone
let gain   = 0;   // eased ripple strength, chasing `reveal`
let raf = 0;
let queued = false;

boot();

function boot() {
    gl = cvs.getContext('webgl', {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        powerPreference: 'low-power',
    });
    if (!gl) return;   // no canvas, no tail — the page stays exactly as it is

    const n = v => v.toFixed(5);   // GLSL has no integer-to-float coercion

    const VERT = `
        attribute vec2 p;
        varying vec2 uv;
        void main(){
            uv = vec2(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5);
            gl_Position = vec4(p, 0.0, 1.0);
        }`;

    /* mediump would be within spec but is genuinely 16-bit on a lot of mobile
       GPUs, and `time` grows without bound — after a few minutes the phase of
       the sines would be noise. */
    const FRAG = `
        #ifdef GL_FRAGMENT_PRECISION_HIGH
        precision highp float;
        #else
        precision mediump float;
        #endif
        varying vec2 uv;
        uniform sampler2D img;
        uniform vec2 frame, origin;
        uniform float time, gain;

        void main(){
            /* Canvas space to painting space. The distortion happens here, in
               the painting's own coordinates, so the waterline stays glued to
               the water however the viewport crops it. */
            vec2 c = uv * frame + origin;

            float d = (c.y - ${n(WATERLINE)}) / ${n(1 - WATERLINE)};
            if (d > 0.0 && gain > 0.0) {
                d = clamp(d, 0.0, 1.0);
                float amp = ${n(HEIGHT)} * gain * (0.06 + 0.94 * pow(d, 1.35));
                float f   = ${n(SIZE)} * mix(2.4, 0.7, d);   // wider up close
                float t   = time * ${n(SPEED)};

                c.x += amp * ( sin(c.y * f * 88.0 + t * 2.10) * 0.55
                             + sin(c.y * f * 39.0 - t * 1.35 + c.x * 3.0) * 0.45 );
                c.y += amp * sin(c.x * f * 52.0 - t * 1.60) * 0.30;
                c.y = max(c.y, ${n(WATERLINE)} + 0.0005);   // never pull the quay down
            }
            gl_FragColor = texture2D(img, clamp(c, 0.0, 1.0));
        }`;

    const compile = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
            throw new Error(gl.getShaderInfoLog(s));
        }
        return s;
    };

    let prog;
    try {
        prog = gl.createProgram();
        gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
        gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
            throw new Error(gl.getProgramInfoLog(prog));
        }
    } catch {
        gl = null;
        return;
    }
    gl.useProgram(prog);

    /* One triangle large enough to cover the clip cube — cheaper than a quad
       and there is nothing else in the scene. */
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const p = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(p);
    gl.vertexAttribPointer(p, 2, gl.FLOAT, false, 0, 0);

    U = {};
    ['img', 'frame', 'origin', 'time', 'gain'].forEach(k => {
        U[k] = gl.getUniformLocation(prog, k);
    });

    tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    /* The painting is 1072x1008 — not a power of two, so anything but
       CLAMP_TO_EDGE and a non-mipmapped filter samples as black. */
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.uniform1i(U.img, 0);

    const im = new Image();
    im.decoding = 'async';
    im.onload = () => {
        imgW = im.naturalWidth || imgW;
        imgH = im.naturalHeight || imgH;
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, im);
        ready = true;
        cvs.style.opacity = '';
        root.classList.add('water-on');
        sync();   // a reload part-way down the page starts already revealed
    };
    im.src = SRC;   // same origin, already in cache from the CSS background
}

/* --------------------------------------------------------------------------
   Reveal

   Straight off the first pixel of scroll, and fully lifted by the time the
   bottom of the roster reaches the top of the screen — so the veil is gone at
   the moment the last card is. Everything past that point is dwell.

   Measured from the live layout every frame rather than cached, so a font
   swap or a rotation cannot leave it stale, and capped by whatever scrolling
   actually exists so the reveal always completes at the bottom of the page
   however short the tail turns out to be.
   -------------------------------------------------------------------------- */

function measure() {
    const gone      = roster.getBoundingClientRect().bottom + scrollY;
    const maxScroll = Math.max(0, root.scrollHeight - innerHeight);
    const travel    = Math.max(1, Math.min(gone, maxScroll));
    return Math.min(1, Math.max(0, scrollY / travel));
}

function sync() {
    const next = measure();
    if (next !== reveal) {
        reveal = next;
        root.style.setProperty('--reveal', reveal.toFixed(4));
    }
    start();
}

function onScroll() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; sync(); });
}

/* --------------------------------------------------------------------------
   Drawing

   The loop is not always running. It draws whatever frame the current state
   asks for and only queues another while the water still has movement in it,
   so a visitor sitting at the top of the page costs nothing.
   -------------------------------------------------------------------------- */

function start() {
    if (!raf && ready && !document.hidden) raf = requestAnimationFrame(draw);
}

function resize() {
    /* A full-viewport fragment shader on a 3x display is a lot of pixels for
       a background. 1.75 is past the point where the ripples look soft. */
    const dpr = Math.min(devicePixelRatio || 1, 1.75);
    const w = Math.max(1, Math.round(cvs.clientWidth * dpr));
    const h = Math.max(1, Math.round(cvs.clientHeight * dpr));
    if (cvs.width !== w || cvs.height !== h) {
        cvs.width = w;
        cvs.height = h;
        gl.viewport(0, 0, w, h);
    }
}

/* The canvas equivalent of `background-size: cover` with the vertical
   position sliding from FRAME_REST to FRAME_REVEAL. */
function place() {
    const w = cvs.width, h = cvs.height;
    const scale = Math.max(w / imgW, h / imgH);
    const dw = imgW * scale, dh = imgH * scale;
    const posY = FRAME_REST + (FRAME_REVEAL - FRAME_REST) * reveal;
    gl.uniform2f(U.frame, w / dw, h / dh);
    gl.uniform2f(U.origin, -(w - dw) * 0.5 / dw, -(h - dh) * posY / dh);
}

function draw(now) {
    raf = 0;
    if (!ready) return;

    /* Ripples fade in with the veil, so the water is never caught moving
       under a page of cards. Reduced motion holds them at zero — the painting
       still comes forward, it just does not move. */
    const target = calm.matches ? 0 : reveal;
    gain += (target - gain) * 0.06;
    if (target === 0 && gain < 0.0015) gain = 0;

    resize();
    place();
    gl.uniform1f(U.time, now / 1000);
    gl.uniform1f(U.gain, gain);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if (gain > 0 && !document.hidden) raf = requestAnimationFrame(draw);
}

/* --------------------------------------------------------------------------
   Wiring
   -------------------------------------------------------------------------- */

addEventListener('scroll', onScroll, {passive: true});
addEventListener('resize', onScroll);
addEventListener('orientationchange', onScroll);
document.addEventListener('visibilitychange', () => { if (!document.hidden) start(); });
calm.addEventListener('change', start);

/* A lost context leaves the drawing buffer blank, which would punch a hole in
   the page. Hiding the canvas puts the still CSS background back on screen;
   the tail stays as it is so the scroll position does not jump. */
cvs.addEventListener('webglcontextlost', e => {
    e.preventDefault();
    ready = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    cvs.style.opacity = '0';
});
cvs.addEventListener('webglcontextrestored', () => boot());
