/* ==========================================================================
   water.js — the canal moves once the roster is out of the way, and the
   houses light up when you point at them

   The painting already contains its own reflection; the canal in it is a
   mirror. Nothing here draws water. It bends the pixels below the waterline
   with a couple of sine waves, which is all it takes to read as moving water.

   On top of that it is a compositor. `layover/` holds the same 1072x1008
   frame painted several times over — the whole scene at different times of
   day, and one transparent layer per house holding just that building and its
   reflection — so a layer drops onto the base with no offset and no seam. The
   shader crossfades the base and blends the houses over it, all of them
   sharing the same distortion, which is what keeps a lit house's reflection
   rippling in step with the water around it.

   It renders onto a fixed, full-viewport canvas sitting directly on top of
   .backdrop's CSS background, framed to match it exactly — so the moment the
   first texture is uploaded and the canvas fades in, nothing appears to
   change.

   Everything is opt-in on success: the tail, the plumb line and the canvas
   itself stay inert until `water-on` lands on <html>. A browser without WebGL
   gets the page exactly as it was, with no empty scroll room below it.

   Add ?dev to the URL for controls over all of it.
   ========================================================================== */

/* The two base scenes. `day` is public/canal.webp rather than a file in
   layover/: the page already loads it as the CSS background and the still
   fallback, so the shader gets it for free instead of a second copy of the
   same picture. The rest come from tools/build_layover.py. */
const DAY   = {key: 'day',   src: 'canal.webp'};
const NIGHT = {key: 'night', src: 'layover/night-dark.webp', afterDark: true};

/* One house, two ways: how it looks picked out in daylight, and how it looks
   with its windows lit. Hovering crossfades the house to whichever of the two
   suits the scene, so pointing at a building in daylight brings the sun out
   on it and pointing at one after dark turns the lights on.

   The two share a silhouette to within a pixel of antialiasing, which is why
   they can be mixed as straight alpha and why either one serves as the hit
   mask. */
const HOUSES = [1, 2, 3, 4].map(n => ({
    lit:  {key: `s${n}`, src: `layover/house${n}-sunny.webp`},
    dark: {key: `n${n}`, src: `layover/house${n}-night-light.webp`, afterDark: true},
}));

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

/* How fast a change crosses. Night is a whole scene turning over and wants to
   feel like weather; a window lighting up should feel like a switch. */
const EASE_NIGHT = 0.055;
const EASE_LIT   = 0.150;

/* The hover mask is read off each house layer's own alpha, downsampled — the
   cutout that aligns the house with the scene doubles as its hit region, so
   there is no second set of coordinates to keep in step with the art. A
   quarter scale is finer than a pointer is accurate. */
const MASK_W = 268;
const MASK_H = 252;
const MASK_HIT = 24;   // alpha above which a pixel counts as the house

const cvs    = document.getElementById('water');
const roster = document.querySelector('.roster');
const root   = document.documentElement;
const calm   = matchMedia('(prefers-reduced-motion: reduce)');
const points = matchMedia('(hover: hover) and (pointer: fine)');

let gl, U;
let LAYERS = [];   // every texture the shader binds, in unit order
let both = true;   // is there room for both variants of every house?
let imgW = 1072, imgH = 1008;
let ready = false;
let reveal = 0;   // 0 while the cards are on screen, 1 once they are gone
let gain   = 0;   // eased ripple strength, chasing `reveal`
let raf = 0;
let queued = false;

/* What the page is asking for, and what is currently on screen chasing it. */
const want = {night: 0, lit: [0, 0, 0, 0]};
const have = {night: 0, lit: [0, 0, 0, 0]};

let hovered = -1;                          // house under the pointer, or -1
const pinned = [false, false, false, false];   // held on from the dev panel

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

    /* Both variants of all four houses plus both base scenes is ten samplers,
       and WebGL 1 only promises eight. Everything current reports sixteen or
       more, but where it does not, the daylight halves are dropped: hovering
       then only lights houses after dark, which is what this did before the
       sunny layers existed. Better a smaller trick than a black screen. */
    both = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS) >= 10;

    LAYERS = [DAY, NIGHT];
    HOUSES.forEach(h => { if (both) LAYERS.push(h.lit); LAYERS.push(h.dark); });

    /* Whichever variant is always present carries the hit mask. */
    HOUSES.forEach(h => { h.hit = both ? h.lit : h.dark; });

    const VERT = `
        attribute vec2 p;
        varying vec2 uv;
        void main(){
            uv = vec2(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5);
            gl_Position = vec4(p, 0.0, 1.0);
        }`;

    /* mediump would be within spec but is genuinely 16-bit on a lot of mobile
       GPUs, and `time` grows without bound — after a few minutes the phase of
       the sines would be noise.

       The branches are all on uniforms, so every pixel in a frame takes the
       same one and the GPU is not paying for the ones it skips. That is what
       keeps the idle cost at a single texture read: with no house lit and the
       scene not mid-crossfade, nine of the ten samplers go untouched. */
    const FRAG = `
        #ifdef GL_FRAGMENT_PRECISION_HIGH
        precision highp float;
        #else
        precision mediump float;
        #endif
        varying vec2 uv;
        uniform sampler2D ${LAYERS.map(l => l.key).join(', ')};
        uniform vec2 frame, origin;
        uniform float time, gain, dark;
        uniform vec4 lit;

        void main(){
            /* Canvas space to painting space. The distortion happens here, in
               the painting's own coordinates, so the waterline stays glued to
               the water however the viewport crops it — and every layer, base
               or house, is displaced identically. */
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
            c = clamp(c, 0.0, 1.0);

            vec3 col;
            if (dark <= 0.0)      col = texture2D(day, c).rgb;
            else if (dark >= 1.0) col = texture2D(night, c).rgb;
            else col = mix(texture2D(day, c).rgb, texture2D(night, c).rgb, dark);

            /* Straight-alpha over, one house at a time. They do not overlap,
               so the order between them does not matter. */
${HOUSES.map((h, i) => house(h, 'xyzw'[i])).join('\n')}

            gl_FragColor = vec4(col, 1.0);
        }`;

    /* A hovered house, crossfaded between its daylight and its lit-window
       version by the same `dark` that drives the scene behind it — so a house
       held lit through a sunset turns over with everything else.

       Without room for both, only the lit-window version exists, and it is
       tied to the dark: dropped onto the day scene it is a night building
       punched into a sunlit street. */
    function house(h, k) {
        return both ? `
            if (lit.${k} > 0.0) {
                vec4 g = mix(texture2D(${h.lit.key}, c), texture2D(${h.dark.key}, c), dark);
                col = mix(col, g.rgb, g.a * lit.${k});
            }` : `
            if (lit.${k} * dark > 0.0) {
                vec4 g = texture2D(${h.dark.key}, c);
                col = mix(col, g.rgb, g.a * lit.${k} * dark);
            }`;
    }

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
    ['frame', 'origin', 'time', 'gain', 'dark', 'lit'].forEach(k => {
        U[k] = gl.getUniformLocation(prog, k);
    });

    /* Every sampler gets a texture up front, filled with one transparent
       pixel. An incomplete texture on any unit — even one no branch reaches —
       is enough for some drivers to fail the whole draw. */
    LAYERS.forEach((layer, unit) => {
        layer.unit = unit;
        layer.tex = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, layer.tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
                      new Uint8Array([0, 0, 0, 0]));
        /* The painting is 1072x1008 — not a power of two, so anything but
           CLAMP_TO_EDGE and a non-mipmapped filter samples as black. */
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.uniform1i(gl.getUniformLocation(prog, layer.key), unit);
        layer.uploaded = false;
        if (layer.img) upload(layer);   // a restored context still has the pixels
    });

    load(DAY).then(() => {
        if (!gl) return;
        ready = true;
        cvs.style.opacity = '';
        root.classList.add('water-on');
        sync();   // a reload part-way down the page starts already revealed

        /* One variant of each house, about 57 KB, once the page is otherwise
           done: its alpha is what the pointer is tested against, so it has to
           be here before the first hover can do anything, and in daylight it
           is also the one that shows.

           Nothing after dark is in this list. The night scene alone is 185 KB
           and the page never asks for it yet — `nightfall` fetches the whole
           dark side the moment something does. */
        const idle = window.requestIdleCallback || (f => setTimeout(f, 1200));
        idle(() => HOUSES.forEach(h => load(h.hit)));
    });
}

/* -------------------------------------------------------------------------
   Layers
   ------------------------------------------------------------------------- */

function load(layer) {
    if (layer.pending) return layer.pending;
    layer.pending = new Promise(done => {
        const im = new Image();
        im.decoding = 'async';
        im.onload = () => {
            layer.img = im;
            if (HOUSES.some(h => h.hit === layer)) mask(layer);
            upload(layer);
            layer.settled = true;
            start();
            done(true);
        };
        /* Settled either way: a layer that will never arrive must not hold
           the scene back from turning, or one 404 freezes the page in day. */
        im.onerror = () => { layer.settled = true; start(); done(false); };
        im.src = layer.src;
    });
    return layer.pending;
}

/* Everything the dark side of the scene needs, fetched together — the night
   base and every lit-window house — so `dark` can only start rising once the
   whole set has landed and no house can be caught halfway through a sunset. */
function nightfall() {
    return Promise.all(LAYERS.filter(l => l.afterDark).map(load));
}

function upload(layer) {
    if (!gl || !layer.img) return;
    if (layer.unit === 0) {
        imgW = layer.img.naturalWidth || imgW;
        imgH = layer.img.naturalHeight || imgH;
    }
    gl.activeTexture(gl.TEXTURE0 + layer.unit);
    gl.bindTexture(gl.TEXTURE_2D, layer.tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, layer.img);
    layer.uploaded = true;
}

/* The alpha channel, downsampled once, as the house's hit region. */
function mask(layer) {
    const c = document.createElement('canvas');
    c.width = MASK_W;
    c.height = MASK_H;
    const g = c.getContext('2d');
    g.drawImage(layer.img, 0, 0, MASK_W, MASK_H);
    const px = g.getImageData(0, 0, MASK_W, MASK_H).data;
    const m = new Uint8Array(MASK_W * MASK_H);
    for (let i = 0, a = 3; i < m.length; i++, a += 4) m[i] = px[a];
    layer.mask = m;
}

/* -------------------------------------------------------------------------
   Reveal

   Straight off the first pixel of scroll, and fully lifted by the time the
   bottom of the roster reaches the top of the screen — so the veil is gone at
   the moment the last card is. Everything past that point is dwell.

   Measured from the live layout every frame rather than cached, so a font
   swap or a rotation cannot leave it stale, and capped by whatever scrolling
   actually exists so the reveal always completes at the bottom of the page
   however short the tail turns out to be.
   ------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------
   Pointing at a house

   Screen to painting is the same mapping the shader does, run backwards. The
   ripple below the waterline is under a pixel of displacement at this scale,
   so the hit test ignores it and reads the undistorted position.
   ------------------------------------------------------------------------- */

function locate(clientX, clientY) {
    const w = cvs.clientWidth, h = cvs.clientHeight;
    const scale = Math.max(w / imgW, h / imgH);      // background-size: cover
    const dw = imgW * scale, dh = imgH * scale;
    const posY = FRAME_REST + (FRAME_REVEAL - FRAME_REST) * reveal;
    return {
        u: (clientX - (w - dw) * 0.5) / dw,
        v: (clientY - (h - dh) * posY) / dh,
    };
}

function houseAt(clientX, clientY) {
    const {u, v} = locate(clientX, clientY);
    if (u < 0 || u >= 1 || v < 0 || v >= 1) return -1;
    const i = ((v * MASK_H) | 0) * MASK_W + ((u * MASK_W) | 0);
    for (let k = 0; k < HOUSES.length; k++) {
        const m = HOUSES[k].hit.mask;
        if (m && m[i] > MASK_HIT) return k;
    }
    return -1;
}

function aim() {
    for (let i = 0; i < HOUSES.length; i++) want.lit[i] = pinned[i] || hovered === i ? 1 : 0;
    start();
}

let pointerQueued = false;
function onPointer(e) {
    if (pointerQueued) return;
    pointerQueued = true;
    const {clientX, clientY} = e;
    requestAnimationFrame(() => {
        pointerQueued = false;
        const next = houseAt(clientX, clientY);
        if (next !== hovered) { hovered = next; aim(); }
    });
}

/* -------------------------------------------------------------------------
   Drawing

   The loop is not always running. It draws whatever frame the current state
   asks for and only queues another while something is still in motion, so a
   visitor sitting at the top of the page costs nothing.
   ------------------------------------------------------------------------- */

function start() {
    if (!raf && ready && !document.hidden) raf = requestAnimationFrame(draw);
}

/* Nothing may be shown before its texture is up, or the layer would flash as
   one transparent pixel stretched over the screen. The scene waits on the
   whole dark side at once; a house waits only on the variant that is always
   resident, since the other one is already covered by that. */
function settle() {
    let moving = false;
    const step = (from, to, rate) => {
        const next = from + (to - from) * rate;
        if (Math.abs(to - next) < 0.002) return to;
        moving = true;
        return next;
    };
    const dusk = LAYERS.every(l => !l.afterDark || l.settled);
    have.night = step(have.night, dusk ? want.night : 0, EASE_NIGHT);
    for (let i = 0; i < HOUSES.length; i++) {
        const shown = HOUSES[i].hit.uploaded ? want.lit[i] : 0;
        have.lit[i] = step(have.lit[i], shown, EASE_LIT);
    }
    return moving;
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

    const settling = settle();

    resize();
    place();
    gl.uniform1f(U.time, now / 1000);
    gl.uniform1f(U.gain, gain);
    gl.uniform1f(U.dark, have.night);
    gl.uniform4f(U.lit, have.lit[0], have.lit[1], have.lit[2], have.lit[3]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if ((gain > 0 || settling) && !document.hidden) raf = requestAnimationFrame(draw);
}

/* -------------------------------------------------------------------------
   Wiring
   ------------------------------------------------------------------------- */

addEventListener('scroll', onScroll, {passive: true});
addEventListener('resize', onScroll);
addEventListener('orientationchange', onScroll);
document.addEventListener('visibilitychange', () => { if (!document.hidden) start(); });
calm.addEventListener('change', start);

if (points.matches) {
    addEventListener('pointermove', onPointer, {passive: true});
    document.addEventListener('pointerleave', () => { hovered = -1; aim(); });
}

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

/* -------------------------------------------------------------------------
   Development

   The finished page has no controls — the scene is whatever the page decides
   and the houses answer to the pointer. This is how you drive it by hand
   while the behaviour is still being worked out, and it costs a page without
   ?dev in the URL nothing at all: the module is never fetched.
   ------------------------------------------------------------------------- */

export const layover = {
    houses: HOUSES.length,
    setNight(v) { want.night = Math.min(1, Math.max(0, v)); if (v > 0) nightfall(); start(); },
    getNight()  { return want.night; },
    pin(i, on)  { pinned[i] = !!on; load(HOUSES[i].hit); aim(); },
    pinned()    { return pinned.slice(); },
    hovered()   { return hovered; },
    bothVariants() { return both; },
};

if (new URLSearchParams(location.search).has('dev')) {
    import('./layover-dev.js').then(m => m.mount(layover)).catch(() => {});
}
