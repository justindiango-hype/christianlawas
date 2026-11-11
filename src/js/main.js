import { gsap } from 'gsap';
import { prepareFrames, hydrate } from './photos.js';
import { initChapters } from './chapters.js';
import { initRotator } from './rotator.js';
import { initMenu } from './menu.js';
import { initGallery } from './gallery.js';
import { initLightbox } from './lightbox.js';
import { initAmbient } from './ambient.js';
import { initHeroFocus } from './focus.js';

document.documentElement.classList.remove('no-js');
document.documentElement.classList.add('js');

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const pad = (n) => String(n).padStart(2, '0');

prepareFrames();
const baseTitle = document.title;
const ambient = initAmbient({ reduced });
const heroFocus = initHeroFocus({ reduced });
let firstChange = true;

/* ---------- Progress UI ---------- */
const ui = {
  name: document.querySelector('.progress__name'),
  current: document.querySelector('.progress__current'),
  total: document.querySelector('.progress__total'),
  bar: document.querySelector('.progress__bar i'),
  prev: document.querySelector('.progress__btn--prev'),
  next: document.querySelector('.progress__btn--next'),
};

const rotator = initRotator(document.querySelector('.rotator'), { reduced });

const chapters = initChapters({
  reduced,
  onChange(i, section) {
    const last = chapters?.sections.length - 1 || 7;
    ui.current.textContent = pad(i);
    ui.name.textContent = section.dataset.name;
    ui.prev.disabled = i === 0;
    ui.next.disabled = i === last;
    gsap.to(ui.bar, { scaleX: i / last, duration: reduced ? 0 : 1, ease: 'expo.inOut' });
    document.body.classList.toggle('is-contact', section.id === 'contact');
    if (section.id === 'intro') rotator?.play(); else rotator?.pause();
    menu?.setActive(section);
    ambient.setChapter(section.id);
    if (section.id === 'intro') heroFocus.play(firstChange ? 0.05 : 0.45); // line up with the wipe
    firstChange = false;
    // page title follows the chapter
    document.title = section.id === 'intro' ? baseTitle : `${section.dataset.name} — Christian Lawas, Photographer in Dubai`;
  },
});
const menu = initMenu({ chapters, reduced });
ui.total.textContent = pad(chapters.sections.length - 1);
ui.prev.addEventListener('click', chapters.prev);
ui.next.addEventListener('click', chapters.next);
document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });

const lightbox = initLightbox({ reduced });
const gallery = initGallery({ chapters, lightbox, reduced });

/* ---------- Loader ---------- */
const loader = document.querySelector('.loader');
const num = loader.querySelector('.loader__num');
const bar = loader.querySelector('.loader__bar i');
const nameParts = loader.querySelectorAll('.loader__name span');
const counter = { v: 0 };

gsap.fromTo(nameParts, { yPercent: 110 }, { yPercent: 0, duration: reduced ? 0 : 1.1, ease: 'expo.out', stagger: 0.08, delay: 0.1 });

const ready = Promise.race([
  Promise.all([
    document.fonts?.ready ?? Promise.resolve(),
    hydrate(chapters.sections[chapters.startIndex]),
    new Promise((r) => setTimeout(r, reduced ? 0 : 1300)),
  ]),
  new Promise((r) => setTimeout(r, 6000)),
]);

const tick = gsap.to(counter, {
  v: 88, duration: 2.4, ease: 'power2.out',
  onUpdate: () => { num.textContent = pad(Math.round(counter.v)); gsap.set(bar, { scaleX: counter.v / 100 }); },
});

let started = false;
function start() {
  if (started) return;
  started = true;
  document.body.classList.remove('is-loading');
  chapters.enter();
  gallery.fromHash();
}

ready.then(() => {
  tick.kill();
  const out = gsap.timeline();
  out.to(counter, {
    v: 100, duration: reduced ? 0 : 0.45, ease: 'power2.out',
    onUpdate: () => { num.textContent = pad(Math.round(counter.v)); gsap.set(bar, { scaleX: counter.v / 100 }); },
  })
    .to(nameParts, { yPercent: -110, duration: reduced ? 0 : 0.7, ease: 'power3.in', stagger: 0.05 }, '+=0.1')
    .to(loader.querySelector('.loader__count'), { opacity: 0, duration: 0.3 }, '<')
    .to(loader, { clipPath: 'inset(0% 0% 100% 0%)', duration: reduced ? 0 : 1.05, ease: 'expo.inOut' }, '-=0.15')
    .add(start, reduced ? undefined : '-=0.55') // overlap the lift with the first entrance
    .add(() => { start(); loader.remove(); }); // safety: always start, even if motion is reduced
});
