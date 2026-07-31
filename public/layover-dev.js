/* ==========================================================================
   layover-dev.js — hand controls for the backdrop

   Loaded only when the URL carries ?dev, by a dynamic import in water.js, so
   the shipped page never fetches it. The finished page has no controls: the
   scene is whatever it decides and the houses answer to the pointer. This is
   for driving both by hand while that is still being worked out.

   Every style here is inline on the elements it belongs to. The panel is not
   part of the design and has no business in style.css, where it would be one
   more block to remember to delete.
   ========================================================================== */

const MONO = "'IBM Plex Mono', ui-monospace, Menlo, monospace";
const INK = '#14181f';

export function mount(layover) {
    const panel = el('div', {
        position: 'fixed', top: '12px', right: '12px', zIndex: '9999',
        width: '186px', padding: '12px 13px 13px',
        background: 'rgba(255,255,255,0.93)',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        border: '1px solid rgba(20,24,31,0.16)', borderRadius: '12px',
        boxShadow: '0 12px 30px -18px rgba(20,24,31,0.7)',
        font: `11px ${MONO}`, color: INK, lineHeight: '1.35',
        userSelect: 'none',
    });

    /* Spans, not bare text: a flex container does not justify text nodes, so
       the two would run together as one word. */
    panel.append(el('div', {
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        letterSpacing: '0.12em', textTransform: 'uppercase',
        fontSize: '9.5px', color: '#6f7681', marginBottom: '10px',
    }, [span('layover'), span('?dev')]));

    /* ---- the clock ----

       The page drives this off the scroll. Touching anything here takes it
       off the scroll and holds it, so you can sit at one hour and read the
       rest of the page past it; `follow` hands it back. */

    const stops = layover.stops();
    const last = stops.length - 1;

    const readout = el('span', {fontVariantNumeric: 'tabular-nums', color: '#6f7681'});
    panel.append(row('hour', readout));

    const slider = el('input', {width: '100%', margin: '0 0 9px', accentColor: '#1e3f8f'});
    Object.assign(slider, {type: 'range', min: '0', max: '100', value: '0'});
    slider.addEventListener('input', () => { layover.setHour(+slider.value / 100); paint(); });
    panel.append(slider);

    const quick = el('div', {display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px'});
    stops.forEach((key, i) => quick.append(button(key, () => {
        layover.setHour(i / last);
        paint();
    })));
    panel.append(quick);

    const follow = button('follow scroll', () => { layover.follow(); paint(); });
    Object.assign(follow.style, {width: '100%', margin: '6px 0 12px'});
    panel.append(follow);

    /* ---- the houses ----

       Pinning holds a house lit regardless of the pointer; unpinned, its chip
       still lights while you are actually over it, which is the quickest way
       to check the hit regions line up with the art. */

    panel.append(row('houses'));

    const chips = [];
    const grid = el('div', {display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px'});
    for (let i = 0; i < layover.houses; i++) {
        const chip = button(`house ${i + 1}`, () => {
            layover.pin(i, !layover.pinned()[i]);
            paint();
        });
        chips.push(chip);
        grid.append(chip);
    }
    panel.append(grid);

    const clear = button('clear', () => {
        for (let i = 0; i < layover.houses; i++) layover.pin(i, false);
        paint();
    });
    Object.assign(clear.style, {width: '100%', marginTop: '6px'});
    panel.append(clear);

    /* Reads the state back rather than tracking it, so the panel stays honest
       when something else moves it — the console, or the page itself. */
    function paint() {
        const hour = layover.getHour();
        slider.value = String(Math.round(hour * 100));
        readout.textContent = `${hour.toFixed(2)} ${stops[Math.round(hour * last)]}`;

        /* Filled while the scroll has it, which is the shipped behaviour. */
        const loose = !layover.held();
        follow.style.background = loose ? INK : 'transparent';
        follow.style.color = loose ? '#fff' : INK;
        follow.style.borderColor = loose ? '#1e3f8f' : 'rgba(20,24,31,0.2)';

        const held = layover.pinned();
        const over = layover.hovered();
        chips.forEach((chip, i) => {
            const on = held[i];
            chip.style.background = on ? INK : 'transparent';
            chip.style.color = on ? '#fff' : (over === i ? '#1e3f8f' : INK);
            chip.style.borderColor = on || over === i ? '#1e3f8f' : 'rgba(20,24,31,0.2)';
        });
    }

    paint();
    document.body.append(panel);

    /* Same handle the panel drives, for poking at from the console. */
    window.layover = layover;

    /* The pointer is handled inside water.js, so the only way to show what it
       is over is to look. A tenth of a second is well under noticing and
       nowhere near the render loop. */
    setInterval(paint, 100);
}

/* -------------------------------------------------------------------------- */

function el(tag, style, kids) {
    const node = document.createElement(tag);
    Object.assign(node.style, style);
    if (kids) node.append(...kids);
    return node;
}

function text(s) {
    return document.createTextNode(s);
}

function span(s) {
    const node = document.createElement('span');
    node.textContent = s;
    return node;
}

function row(label, extra) {
    const r = el('div', {
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        marginBottom: '5px',
    });
    r.append(text(label));
    if (extra) r.append(extra);
    return r;
}

function button(label, onClick) {
    const b = el('button', {
        font: `10px ${MONO}`, letterSpacing: '0.04em',
        padding: '5px 0', flex: '1',
        background: 'transparent', color: INK,
        border: '1px solid rgba(20,24,31,0.2)', borderRadius: '7px',
        cursor: 'pointer',
    });
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
}
