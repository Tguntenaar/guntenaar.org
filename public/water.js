/* ==========================================================================
   water.js — the canal moves once the roster is out of the way, the day goes
   down as you scroll, and the houses light up when you point at them

   The painting already contains its own reflection; the canal in it is a
   mirror. Nothing here draws water. It bends the pixels below the waterline
   with a couple of sine waves, which is all it takes to read as moving water.

   On top of that it is a compositor. `layover/` holds the same 1072x1008
   frame painted several times over — the whole scene at four times of day,
   one transparent layer per house holding just that building and its
   reflection, and the two things the canal has after dark that it does not
   have before — so a layer drops onto the base with no offset and no seam.

   Scroll is the clock. The shader runs the four scenes as one ramp, day to
   night, crossfading whichever pair the page has scrolled between, and blends
   the night sky, the lit boat and any lit house over the top. All of them
   share the same distortion, which is what keeps a lit house's reflection
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

/* The scene, in the order you scroll through it. `day` is public/canal.webp
   rather than a file in layover/: the page already loads it as the CSS
   background and the still fallback, so the shader gets it for free instead
   of a second copy of the same picture. The rest come from
   tools/build_layover.py.

   `band` is what fills the screen above and below the painting at that stop —
   the mean of that painting's own brightest five per cent, which for a
   watercolour is its paper. Day's is the page's own --shell, which is where
   that measurement came from in the first place. The last stop breaks the
   rule and takes its night sky instead: after dark the paper is not lit, and
   the sky is what the eye reads the picture as sitting in.

   The middle two are `optional`. A GPU short of texture units drops them and
   the ramp runs straight from day to night, which is what this did before
   they existed. */
const STOPS = [
    {key: 'day',    src: 'canal.webp',              band: [0xef, 0xed, 0xe9]},
    {key: 'sunny',  src: 'layover/day-sunny.webp',  band: [0xe7, 0xe4, 0xd7], optional: true},
    {key: 'golden', src: 'layover/day-golden.webp', band: [0xf6, 0xce, 0xaf], optional: true},
    {key: 'night',  src: 'layover/night-dark.webp', band: [0x11, 0x24, 0x46], afterDark: true},
];

/* Laid over the whole scene as the last crossfade runs, at whatever strength
   it has reached: the sky the night was painted with — stars, and a moon that
   covers over the one night-dark carries — and the tour boat with its windows
   lit. Neither is a variant of anything and neither answers to the pointer.
   They are simply what the canal has after dark, arriving as the dark does. */
const AFTER_DARK = [
    {key: 'sky',  src: 'layover/nightsky.webp', afterDark: true},
    {key: 'boat', src: 'layover/boat.webp',     afterDark: true},
];

/* One house, two ways: how it looks picked out in daylight, and how it looks
   with its windows lit. Hovering crossfades the house to whichever of the two
   suits the scene, so pointing at a building in daylight brings the sun out
   on it and pointing at one after dark turns the lights on.

   Only two, for four scenes: the crossfade between them is the last one of
   the ramp, so the sunny cutout stands in for every hour before dusk. That is
   free at the first stop and at the last, and through the middle it reads as
   a facade still catching light the sky has already lost — but at the sunny
   stop itself there is nothing brighter to reach for, and pointing at a house
   in full sun does very little. Fixing that honestly is four more samplers.

   The two share a silhouette to within a pixel of antialiasing, which is why
   they can be mixed as straight alpha and why either one serves as the hit
   mask. */

/* And where each one goes. A house that lights up under the pointer is
   claiming to be interactive, so it is: one house per Guntenaar, in the order
   they stand along the canal — Joost, Boris, Thomas, Olivier, left to right.

   The layers are numbered in the order they were cut, not in the order they
   stand, so this is the one place the two are reconciled. If the art is
   recut, sort layover/houseN-sunny.webp by the left edge of its alpha bounding
   box and renumber here; nothing else in the file cares about the order.

   Every one of these addresses is also a link in the roster, so the canal is
   an extra way to reach them and never the only way. */
const HOMES = {
    2: 'https://joost.guntenaar.org/',
    1: 'https://zgdrone.com/',
    4: 'https://thomasguntenaar.com/',
    3: 'https://oguntenaar.com/',
};

const HOUSES = [1, 2, 3, 4].map(n => ({
    href: HOMES[n],
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

/* The painting is fitted to the width of the screen and never cropped
   sideways: all four houses have to be reachable, and on a phone a cover fit
   throws the outer two off the edges entirely.

   Where that leaves it taller than the screen — any window wider than it is
   tall, which is most of them — this is how it is framed vertically, in the
   units background-position takes. Centred at rest, sinking toward the water
   as the veil lifts. REST must stay in step with .backdrop's
   `background-position` or the canvas would pop when it fades in.

   Where it leaves the painting shorter than the screen, there is nothing to
   sink into and it simply sits in the middle of its bands. */
const FRAME_REST   = 0.50;
const FRAME_REVEAL = 0.70;

/* How much scrolling each crossfade gets, in screenfuls, and how long the
   page goes on after the last one lands. A scene wants long enough that you
   watch it happen rather than catch it out of the corner of your eye: a whole
   screen of scrolling per crossfade is about the pace of the light actually
   changing. SCREENS is also the floor on how long the first scene is held
   before any of it starts. These two are what the tail is sized from — see
   `dawn` and `room`. */
const SCREENS = 1;
const DWELL   = 0.35;

/* How fast a change crosses. The ramp follows the scroll, so it wants to keep
   up while still letting the sky take a moment to turn; a window lighting up
   should feel like a switch. */
const EASE_HOUR = 0.100;
const EASE_LIT  = 0.150;

/* The hover mask is read off each house layer's own alpha, downsampled — the
   cutout that aligns the house with the scene doubles as its hit region, so
   there is no second set of coordinates to keep in step with the art. A
   quarter scale is finer than a pointer is accurate. */
const MASK_W = 268;
const MASK_H = 252;
const MASK_HIT = 24;   // alpha above which a pixel counts as the house

const cvs    = document.getElementById('water');
const roster = document.querySelector('.roster');
const page   = document.querySelector('.page');
const root   = document.documentElement;
const calm   = matchMedia('(prefers-reduced-motion: reduce)');
const points = matchMedia('(hover: hover) and (pointer: fine)');

let gl, U;
let LAYERS = [];    // every texture the shader binds, in unit order
let SCENE = STOPS;  // the stops this GPU has room for, in ramp order
let both = true;    // is there room for both variants of every house?
let imgW = 1072, imgH = 1008;
let ready = false;
let reveal = 0;   // 0 while the cards are on screen, 1 once they are gone
let gain   = 0;   // eased ripple strength, chasing `reveal`
let raf = 0;
let queued = false;
let falling = false;   // has the dark side been asked for yet?
let tail = -1;         // scroll room past the roster, in px

/* What the page is asking for, and what is currently on screen chasing it.
   `hour` is the whole ramp as one number: 0 at the first stop, 1 at the last,
   and the stops evenly spaced between. */
const want = {hour: 0, lit: [0, 0, 0, 0]};
const have = {hour: 0, lit: [0, 0, 0, 0]};

/* An hour set by hand from the dev panel, which the page then stops driving
   until it is handed back. Null the rest of the time, which is always. */
let held = null;

const clamp01 = v => Math.min(1, Math.max(0, v));

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
    const rgb = c => `vec3(${c.map(v => n(v / 255)).join(', ')})`;

    /* Four scenes, the two things the night adds and both variants of all
       four houses is fourteen samplers, and WebGL 1 only promises eight.
       Everything current reports sixteen or more. Where it does not, the
       daylight house halves go first — hovering then only lights houses after
       dark, which is what this did before the sunny layers existed — and
       below ten the two middle scenes go with them, leaving the straight
       day-to-night crossfade this had before they existed. Eight samplers is
       the floor, and that is the floor of the spec. */
    const units = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
    both  = units >= 14;
    SCENE = STOPS.filter(s => units >= 10 || !s.optional);

    LAYERS = [...SCENE, ...AFTER_DARK];
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
       keeps the idle cost down to a single texture read: with no house lit and
       the ramp sitting on a stop, thirteen of the fourteen samplers go
       untouched.

       The ramp itself is a chain of those branches, written out from STOPS:
       `t` runs from 0 at the first stop to LAST at the last, and only the pair
       either side of it is ever read. The picture and the bands around it are
       generated from the same array by the same helper, so adding a scene adds
       it to both at once — `as` is only how a stop turns into an expression,
       a texture read in one and a constant colour in the other. */
    const LAST = SCENE.length - 1;
    const ramp = as => SCENE.slice(1)
        .map((s, i) => `    if (t < ${n(i + 1)}) return mix(${as(SCENE[i])}, ${as(s)}, t - ${n(i)});`)
        .join('\n            ');

    const FRAG = `
        #ifdef GL_FRAGMENT_PRECISION_HIGH
        precision highp float;
        #else
        precision mediump float;
        #endif
        varying vec2 uv;
        uniform sampler2D ${LAYERS.map(l => l.key).join(', ')};
        uniform vec2 frame, origin;
        uniform float time, gain, hour;
        uniform vec4 lit;

        /* The scene at hour t: two texture reads while the ramp is between
           stops, one while it is sitting on either end. */
        vec3 scene(vec2 c, float t){
            if (t <= 0.0) return texture2D(${SCENE[0].key}, c).rgb;
            ${ramp(s => `texture2D(${s.key}, c).rgb`)}
            return texture2D(${SCENE[LAST].key}, c).rgb;
        }

        /* What fills the screen above and below the painting, on the same
           ramp — so the frame turns over with the picture in it. */
        vec3 band(float t){
            ${ramp(s => rgb(s.band))}
            return ${rgb(SCENE[LAST].band)};
        }

        void main(){
            /* Canvas space to painting space. The distortion happens here, in
               the painting's own coordinates, so the waterline stays glued to
               the water however the viewport crops it — and every layer, base
               or house, is displaced identically. */
            vec2 c = uv * frame + origin;

            float t = clamp(hour, 0.0, 1.0) * ${n(LAST)};
            /* The last crossfade on its own: how far into the dark the scene
               is, which is what the night layers and the lit windows ride on
               and what everything before dusk sees as zero. */
            float dark = clamp(t - ${n(LAST - 1)}, 0.0, 1.0);

            /* Off the edge of the painting: the bands above and below it.
               Tested before the water bends anything, so the waterline cannot
               smear the picture out over its own frame. */
            if (c.x < 0.0 || c.x > 1.0 || c.y < 0.0 || c.y > 1.0) {
                gl_FragColor = vec4(band(t), 1.0);
                return;
            }

            float d = (c.y - ${n(WATERLINE)}) / ${n(1 - WATERLINE)};
            if (d > 0.0 && gain > 0.0) {
                d = clamp(d, 0.0, 1.0);
                float amp = ${n(HEIGHT)} * gain * (0.06 + 0.94 * pow(d, 1.35));
                float f   = ${n(SIZE)} * mix(2.4, 0.7, d);   // wider up close
                float w   = time * ${n(SPEED)};

                c.x += amp * ( sin(c.y * f * 88.0 + w * 2.10) * 0.55
                             + sin(c.y * f * 39.0 - w * 1.35 + c.x * 3.0) * 0.45 );
                c.y += amp * sin(c.x * f * 52.0 - w * 1.60) * 0.30;
                c.y = max(c.y, ${n(WATERLINE)} + 0.0005);   // never pull the quay down
            }
            c = clamp(c, 0.0, 1.0);

            vec3 col = scene(c, t);

            /* Sky first, then the boat: the sky belongs behind everything,
               and nothing else here overlaps. Straight-alpha over, so a layer
               only touches the pixels it was painted on. */
            if (dark > 0.0) {
                vec4 o;
${AFTER_DARK.map(l => `                o = texture2D(${l.key}, c); col = mix(col, o.rgb, o.a * dark);`).join('\n')}
            }

            /* Then the houses, one at a time. They do not overlap either, so
               the order between them does not matter. */
${HOUSES.map((h, i) => house(h, 'xyzw'[i])).join('\n')}

            gl_FragColor = vec4(col, 1.0);
        }`;

    /* A hovered house, crossfaded between its daylight and its lit-window
       version by the same `dark` the night layers ride on — so a house held
       lit through a sunset turns over with everything else.

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
    ['frame', 'origin', 'time', 'gain', 'hour', 'lit'].forEach(k => {
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

    load(SCENE[0]).then(() => {
        if (!gl) return;
        ready = true;
        cvs.style.opacity = '';
        room();   // before the tail exists, so it is never briefly the wrong length
        root.classList.add('water-on');
        sync();   // a reload part-way down the page starts already revealed

        /* One variant of each house, about 57 KB, once the page is otherwise
           done: its alpha is what the pointer is tested against, so it has to
           be here before the first hover can do anything, and in daylight it
           is also the one that shows.

           Nothing further along the ramp is in this list. The rest of the
           scenes come to about 750 KB between them and a visitor who never
           scrolls never sees one; `askHour` fetches each as the crossfade
           that ends on it begins. */
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
            start();
            done(true);
        };
        im.onerror = () => { start(); done(false); };
        im.src = layer.src;
    });
    return layer.pending;
}

/* Everything the dark side of the scene needs, fetched together — the night
   painting, the sky and the boat over it, and every lit-window house — so the
   dark can only start falling once the whole set has landed and nothing can
   be caught halfway through a sunset. Asked for on every scroll event past
   dusk, so it only does the work once. */
function nightfall() {
    if (falling) return;
    falling = true;
    LAYERS.filter(l => l.afterDark).forEach(load);
}

/* Whether that set is here. */
function dusk() {
    return LAYERS.every(l => !l.afterDark || l.uploaded);
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
   Scroll

   Two things read off the same gesture, over different distances.

   The veil goes straight off the first pixel and is fully lifted by the time
   the bottom of the roster reaches the top of the screen — so it is gone at
   the moment the last card is.

   The clock waits for it. Nothing moves until the veil is spent and the last
   card is off the top of the screen, so the painting gets a stretch of being
   nothing but itself, in plain daylight, before the light starts going. Then
   a whole screen of scrolling per crossfade, so a scene arrives, holds and
   gives way rather than flickering past.

   That is most of the page's length, and it is what `room` sizes the tail
   from — which means the tail past the roster is not somewhere to sit and
   watch the water, it is the day going down.

   Everything is measured from the live layout every time rather than cached,
   so a font swap or a rotation cannot leave it stale, and everything is
   capped by whatever scrolling actually exists so it still completes at the
   bottom of the page however short it turns out to be.
   ------------------------------------------------------------------------- */

function sync() {
    room();
    const maxScroll = Math.max(0, root.scrollHeight - innerHeight);

    const travel = Math.max(1, Math.min(gone(), maxScroll));
    const next   = clamp01(scrollY / travel);
    if (next !== reveal) {
        reveal = next;
        root.style.setProperty('--reveal', reveal.toFixed(4));
    }

    const first = dawn();
    const day = Math.max(1, Math.min(ramp(), maxScroll - first));
    if (held === null) askHour((scrollY - first) / day);
    start();
}

/* Where the roster ends, in the page's own coordinates. */
function gone() {
    return roster.getBoundingClientRect().bottom + scrollY;
}

/* Where the light starts moving: once the cards have left, with a screenful
   as the floor so a window taller than the roster still gets its moment of
   plain day. Below this the scene sits on the first stop. */
function dawn() {
    return Math.max(SCREENS * innerHeight, gone());
}

/* The scroll the day itself wants, once it starts: one screen per crossfade. */
function ramp() {
    return SCREENS * (SCENE.length - 1) * innerHeight;
}

/* And the empty scroll it takes to have all of that — the wait, the day, and
   a moment to sit at the end of it, less however much the page itself already
   provides.

   Set from here rather than written in the stylesheet because most of it is
   not knowable in vh: the roster's own height is not, and it is the
   difference between a phone and a desktop. Written only when it actually
   changes, so a scroll frame is not laying the page out twice for nothing. */
function room() {
    const need = Math.max(0, Math.round(
        dawn() + ramp() + (DWELL + 1) * innerHeight - page.offsetHeight));
    if (need !== tail) {
        tail = need;
        root.style.setProperty('--tail', `${tail}px`);
    }
}

/* Ask the scene for a time of day, and fetch what it will take to get there.

   Each scene is requested as the crossfade that ends on it begins, which is a
   screenful of scrolling of warning. Scroll faster than the network and
   nothing tears: `reach` holds the ramp at the last stop it actually has, and
   it catches up when the next one lands. */
function askHour(v) {
    want.hour = clamp01(v);
    const t = want.hour * (SCENE.length - 1);
    for (let i = 1; i < SCENE.length; i++) {
        if (t > i - 1) SCENE[i].afterDark ? nightfall() : load(SCENE[i]);
    }
    start();
}

/* How far along the ramp the textures allow. Nothing may be shown before its
   own is up, or a stop would crossfade into the one transparent pixel its
   sampler starts life holding, stretched over the whole screen.

   A scene that never arrives simply leaves the clock stopped at the one
   before it. That is the failure worth having: the page still scrolls, the
   veil still lifts and the water still moves — the light just stays where it
   is rather than fading the picture out to black. */
function reach() {
    let k = 0;
    for (let i = 1; i < SCENE.length; i++) {
        if (!(SCENE[i].afterDark ? dusk() : SCENE[i].uploaded)) break;
        k = i;
    }
    return k / (SCENE.length - 1);
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
    /* CSS pixels rather than device pixels — `fit` is a ratio either way. */
    const {dw, dh, offX, offY} = fit(cvs.clientWidth, cvs.clientHeight);
    return {u: (clientX - offX) / dw, v: (clientY - offY) / dh};
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

/* A house is only somewhere to click while the column is not in the way. The
   painting runs the full width of the window and the roster sits over the
   middle of it, so at the top of the page two of the four houses are behind
   cards — and there the card is the thing you are pointing at. The lighting is
   left alone either way: it is the painting responding to the pointer, and it
   reads as that through a card the same as beside one. */
function overPage(target) {
    return !!target && page.contains(target);
}

function offer(on) {
    root.classList.toggle('to-a-house', on);
}

let pointerQueued = false;
function onPointer(e) {
    if (pointerQueued) return;
    pointerQueued = true;
    const {clientX, clientY, target} = e;
    requestAnimationFrame(() => {
        pointerQueued = false;
        const next = houseAt(clientX, clientY);
        if (next !== hovered) { hovered = next; aim(); }
        offer(next >= 0 && !overPage(target));
    });
}

function onClick(e) {
    if (overPage(e.target)) return;
    const i = houseAt(e.clientX, e.clientY);
    if (i >= 0) location.href = HOUSES[i].href;
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

/* Everything on screen easing toward what the page is asking for, held back
   by what has actually loaded. The ramp waits on `reach`; a house waits only
   on the variant that is always resident, since the other one is a night
   layer and the ramp cannot reach the dark without it. */
function settle() {
    let moving = false;
    const step = (from, to, rate) => {
        const next = from + (to - from) * rate;
        if (Math.abs(to - next) < 0.002) return to;
        moving = true;
        return next;
    };
    const was = have.hour;
    have.hour = step(have.hour, Math.min(want.hour, reach()), EASE_HOUR);
    if (have.hour !== was) surround();
    for (let i = 0; i < HOUSES.length; i++) {
        const shown = HOUSES[i].hit.uploaded ? want.lit[i] : 0;
        have.lit[i] = step(have.lit[i], shown, EASE_LIT);
    }
    return moving;
}

/* The bands are painted twice over: by the shader, which owns every pixel of
   the canvas, and by --surround, which is what shows through in the moment
   before the canvas has a texture and behind the page as it overscrolls.
   `band` here and `band` in the shader are the same ramp over the same
   constants, so the two cannot disagree. */
function surround() {
    root.style.setProperty('--surround', `rgb(${band(have.hour).join(' ')})`);
}

function band(v) {
    const t = clamp01(v) * (SCENE.length - 1);
    const i = Math.min(SCENE.length - 2, Math.floor(t));
    const f = t - i;
    return SCENE[i].band.map((c, k) => Math.round(c + (SCENE[i + 1].band[k] - c) * f));
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

/* Where the painting sits, in device pixels: the canvas equivalent of
   `background-size: 100% auto` with the vertical position sliding from
   FRAME_REST to FRAME_REVEAL. The one place the framing is decided — `locate`
   runs it backwards, and the two must not drift apart. */
function fit(w, h) {
    const scale = w / imgW;              // fit the width, crop nothing sideways
    const dw = w, dh = imgH * scale;
    const room = h - dh;
    /* Only somewhere to sink if the painting overruns the screen. Where it
       does not, it sits in the middle of its bands and stays there. */
    const posY = room < 0 ? FRAME_REST + (FRAME_REVEAL - FRAME_REST) * reveal : 0.5;
    return {dw, dh, offX: (w - dw) * 0.5, offY: room * posY};
}

function place() {
    const w = cvs.width, h = cvs.height;
    const {dw, dh, offX, offY} = fit(w, h);
    gl.uniform2f(U.frame, w / dw, h / dh);
    gl.uniform2f(U.origin, -offX / dw, -offY / dh);
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
    gl.uniform1f(U.hour, have.hour);
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

/* Pointer devices only. Without hover there is nothing to say a house is
   interactive before you touch it, and a tap on the backdrop that navigated
   somewhere unannounced would be a trap. */
if (points.matches) {
    addEventListener('pointermove', onPointer, {passive: true});
    addEventListener('click', onClick);
    document.addEventListener('pointerleave', () => { hovered = -1; offer(false); aim(); });
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
    stops()     { return SCENE.map(s => s.key); },
    /* Taking the clock off the scroll and putting it back. Held, the page
       stops driving it, so you can sit at one hour and scroll through the
       rest of the design. */
    setHour(v)  { held = clamp01(v); askHour(held); },
    getHour()   { return want.hour; },
    follow()    { held = null; sync(); },
    held()      { return held !== null; },
    pin(i, on)  { pinned[i] = !!on; load(HOUSES[i].hit); aim(); },
    pinned()    { return pinned.slice(); },
    hovered()   { return hovered; },
    bothVariants() { return both; },
};

if (new URLSearchParams(location.search).has('dev')) {
    import('./layover-dev.js').then(m => m.mount(layover)).catch(() => {});
}
