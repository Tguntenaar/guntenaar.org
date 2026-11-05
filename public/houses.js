// Native details keep every address usable without JavaScript. Hover is an
// enhancement; a tap, Enter or Space pins one house open.
const people = [...document.querySelectorAll('.person[data-house]')];
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
const calm = matchMedia('(prefers-reduced-motion: reduce)');
let active = null;
let pinned = null;
let pointing = null;
let introTimer = 0;
let introPerson = null;
let introCancelled = false;

function describeHouse(person, preview = false) {
    document.dispatchEvent(new CustomEvent('housechange', {
        detail: {house: person ? Number(person.dataset.house) : null, preview},
    }));
}

function cancelIntro() {
    if (introCancelled) return;
    introCancelled = true;
    clearTimeout(introTimer);
    if (introPerson) {
        introPerson.classList.remove('is-introducing');
        introPerson = null;
        describeHouse(active);
    }
}

async function introduce() {
    if (calm.matches) return;
    // A slow portrait or font should not spend its introduction invisible.
    await Promise.allSettled([
        ...people.map(person => person.querySelector('.portrait').decode()),
        document.fonts.ready,
    ]);
    if (introCancelled || document.hidden || calm.matches) return;
    let index = 0;
    function next() {
        if (introCancelled) return;
        if (index === people.length) { cancelIntro(); return; }
        const person = people[index++];
        introPerson = person;
        person.classList.add('is-introducing');
        describeHouse(person, true);
        introTimer = setTimeout(() => {
            person.classList.remove('is-introducing');
            introPerson = null;
            describeHouse(active);
            introTimer = setTimeout(next, 180);
        }, 1250);
    }
    introTimer = setTimeout(next, 300);
}

function fitPanel() {
    if (!active) return;
    const panel = active.querySelector('.house-info');
    panel.style.setProperty('--panel-shift', '0px');
    const overflow = panel.getBoundingClientRect().bottom - innerHeight + 24;
    panel.style.setProperty('--panel-shift', `${-Math.max(0, overflow)}px`);
}

function show(person) {
    cancelIntro();
    active = person;
    for (const item of people) {
        item.querySelector('details').open = item === person;
        item.classList.toggle('is-active', item === person);
    }
    fitPanel();
    describeHouse(person);
}

for (const person of people) {
    const summary = person.querySelector('summary');
    person.addEventListener('focusin', cancelIntro);
    person.addEventListener('pointerenter', event => {
        if (!finePointer.matches || event.pointerType === 'touch') return;
        pointing = person;
        pinned = null;
        show(person);
    });
    person.addEventListener('pointerleave', () => {
        if (pointing === person) pointing = null;
        if (person.querySelector('.house-info').contains(document.activeElement)) return;
        show(pinned);
    });
    summary.addEventListener('click', event => {
        event.preventDefault();
        if (event.pointerType === 'mouse' && finePointer.matches) {
            pinned = null;
            show(person);
            return;
        }
        pinned = pinned === person ? null : person;
        show(pinned);
    });
    person.addEventListener('focusout', () => {
        requestAnimationFrame(() => {
            if (active === person && !person.contains(document.activeElement) && !pointing) {
                pinned = null;
                show(null);
            }
        });
    });
}

document.addEventListener('pointerdown', event => {
    cancelIntro();
    if (!event.target.closest('.person')) {
        pinned = null;
        show(null);
    }
});

addEventListener('resize', fitPanel);
addEventListener('scroll', cancelIntro, {passive: true, once: true});
document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelIntro();
});
calm.addEventListener('change', () => { if (calm.matches) cancelIntro(); });

document.addEventListener('keydown', event => {
    cancelIntro();
    if (event.key !== 'Escape' || !active) return;
    const summary = active.querySelector('summary');
    pinned = null;
    show(null);
    summary.focus({preventScroll: true});
});

introduce();
