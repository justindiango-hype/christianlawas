/**
 * Collection galleries.
 * Each category opens in its own full-screen layer with a layout that suits it:
 *   spread — editorial pairs (weddings, maternity, portraits)
 *   panels — wide, one per row (spaces)
 *   sheet  — contact-sheet rows that keep every photo uncropped (events)
 */
import { gsap } from 'gsap';
import Lenis from 'lenis';
import manifest from '../data/photos.json';

const BASE = import.meta.env.BASE_URL;

export const COLLECTIONS = [
  { id: 'weddings', chapter: 1, num: '01', title: 'Weddings', layout: 'spread', intro: 'Nikkahs, ceremonies and receptions across Dubai, photographed quietly and closely.' },
  { id: 'maternity', chapter: 2, num: '02', title: 'Maternity', layout: 'spread', intro: 'Sunset beach sessions and quiet moments at home, for the weeks before everything changes.' },
  { id: 'portraits', chapter: 3, num: '03', title: 'Portraits', layout: 'spread', intro: 'Studio headshots and natural-light portraits, clean and true to the person.' },
  { id: 'spaces', chapter: 4, num: '04', title: 'Spaces', layout: 'panels', intro: 'Villas, interiors and architecture, composed to show the light and the line of a home.' },
  { id: 'events', chapter: 5, num: '05', title: 'Events', layout: 'sheet', intro: 'Corporate events, performances, launches and celebrations, documented as they happen.' },
];

const srcset = (p) => p.sizes.map((s) => `${BASE}${s.src} ${s.w}w`).join(', ');
const pad = (n) => String(n).padStart(2, '0');

/** Arrange photos into editorial rows on a 12-column grid. */
function spreadPlan(photos) {
  const plan = [];
  let i = 0; let flip = false;
  const tall = (p) => p.ratio < 1.1;
  while (i < photos.length) {
    const a = photos[i]; const b = photos[i + 1];
    if (!tall(a)) {
      plan.push({ i, col: flip ? '5 / span 8' : '1 / span 8', wide: true });
      i += 1;
    } else if (b && tall(b)) {
      plan.push({ i, col: flip ? '2 / span 4' : '1 / span 5' });
      plan.push({ i: i + 1, col: flip ? '7 / span 5' : '8 / span 4', offset: true });
      i += 2;
    } else if (b) {
      plan.push({ i, col: flip ? '9 / span 4' : '1 / span 4' });
      plan.push({ i: i + 1, col: flip ? '1 / span 7' : '6 / span 7', wide: true, offset: true });
      i += 2;
    } else {
      plan.push({ i, col: '4 / span 5' });
      i += 1;
    }
    flip = !flip;
  }
  return plan;
}

export function initGallery({ chapters, lightbox, reduced = false }) {
  const initialHash = location.hash; // read before the chapters rewrite the address
  const body = document.body;
  const root = document.getElementById('gallery');
  const scroller = root.querySelector('.gallery__scroller');
  const content = root.querySelector('.gallery__content');
  const $ = (k) => root.querySelector(`[data-g="${k}"]`);
  const grid = $('grid');
  const titleSpan = $('title');
  const D = (s) => (reduced ? 0.01 : s);
  let current = null;
  let lenis = null;
  let io = null;
  let open = false;

  function tile(photo, n, col, cls = '') {
    const cell = document.createElement('div');
    cell.className = `g-cell ${cls}`.trim();
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'g-item';
    btn.style.aspectRatio = `${photo.w} / ${photo.h}`;
    btn.style.backgroundColor = photo.color;
    btn.dataset.index = n;
    btn.setAttribute('aria-label', `Open photo ${n + 1} of ${col.photos.length}`);
    const zoom = document.createElement('span');
    zoom.className = 'g-zoom';
    const img = document.createElement('img');
    img.alt = `${col.title} by Christian Lawas, photo ${n + 1}`;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.width = photo.w; img.height = photo.h;
    img.sizes = col.layout === 'sheet' ? '(max-width: 860px) 50vw, 24vw' : col.layout === 'panels' ? '(max-width: 860px) 92vw, 80vw' : '(max-width: 860px) 92vw, 50vw';
    img.srcset = srcset(photo);
    img.src = BASE + photo.sizes[0].src;
    img.addEventListener('load', () => img.classList.add('is-loaded'), { once: true });
    zoom.appendChild(img);
    btn.appendChild(zoom);
    const cap = document.createElement('p');
    cap.className = 'g-cap';
    cap.innerHTML = col.layout === 'sheet'
      ? `<span>CL—${String(n + 1).padStart(3, '0')}</span>`
      : `<span>${pad(n + 1)}</span><span>${col.title}</span>`;
    cell.append(btn, cap);
    return cell;
  }

  function render(col) {
    const photos = manifest[col.id] || [];
    col.photos = photos;
    current = col;
    grid.className = `gallery__grid layout-${col.layout}`;
    grid.replaceChildren();
    if (col.layout === 'spread') {
      spreadPlan(photos).forEach((p) => {
        const cell = tile(photos[p.i], p.i, col, `${p.wide ? 'is-wide' : ''} ${p.offset ? 'is-offset' : ''}`);
        cell.style.gridColumn = p.col;
        grid.appendChild(cell);
      });
    } else {
      photos.forEach((p, n) => {
        const cell = tile(p, n, col);
        if (col.layout === 'sheet') cell.style.setProperty('--r', p.ratio);
        grid.appendChild(cell);
      });
    }
    const idx = COLLECTIONS.indexOf(col);
    const next = COLLECTIONS[(idx + 1) % COLLECTIONS.length];
    $('crumb').textContent = col.title;
    $('count').textContent = `${photos.length} photographs`;
    titleSpan.textContent = col.title;
    $('intro').textContent = col.intro;
    $('nextTitle').textContent = next.title;
    $('next').setAttribute('href', `#${next.id}/collection`);
    $('next').dataset.next = next.id;
    observe();
  }

  /* reveal tiles as they scroll into view */
  function observe() {
    io?.disconnect();
    const cells = [...grid.querySelectorAll('.g-cell')];
    if (reduced) return;
    gsap.set(cells.map((c) => c.querySelector('.g-item')), { clipPath: 'inset(100% 0% 0% 0%)' });
    gsap.set(cells.map((c) => c.querySelector('.g-zoom')), { scale: 1.22 });
    gsap.set(cells.map((c) => c.querySelector('.g-cap')), { opacity: 0 });
    io = new IntersectionObserver((entries) => {
      const visible = entries.filter((e) => e.isIntersecting);
      visible.forEach((e, k) => {
        io.unobserve(e.target);
        const delay = k * (current.layout === 'sheet' ? 0.05 : 0.12);
        const item = e.target.querySelector('.g-item');
        gsap.to(item, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.2, ease: 'expo.inOut', delay });
        gsap.to(e.target.querySelector('.g-zoom'), { scale: 1, duration: 1.8, ease: 'expo.out', delay: delay + 0.1, clearProps: 'transform' });
        gsap.to(e.target.querySelector('.g-cap'), { opacity: 1, duration: 0.8, delay: delay + 0.6 });
      });
    }, { root: scroller, rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    cells.forEach((c) => io.observe(c));
  }

  function headIn(at = 0) {
    const tl = gsap.timeline({ delay: at });
    tl.fromTo(titleSpan, { yPercent: 105 }, { yPercent: 0, duration: D(1.3), ease: 'expo.out' })
      .fromTo(root.querySelectorAll('[data-g-reveal], .gallery__bar'), { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: D(0.9), ease: 'power3.out', stagger: 0.08 }, 0.15);
    return tl;
  }

  function startScroll() {
    lenis?.destroy();
    scroller.scrollTop = 0;
    if (reduced) return;
    lenis = new Lenis({ wrapper: scroller, content, duration: 1.15, smoothWheel: true, autoRaf: true });
  }

  function openGallery(id, { push = true } = {}) {
    const col = COLLECTIONS.find((c) => c.id === id);
    if (!col || open || body.classList.contains('is-loading')) return;
    open = true;
    render(col);
    root.hidden = false;
    body.classList.add('is-overlay', 'is-gallery');
    startScroll();
    if (push) history.pushState({ gallery: id }, '', `#${id}/collection`);
    gsap.fromTo(root, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: D(1.1), ease: 'expo.inOut' });
    headIn(reduced ? 0 : 0.5);
    setTimeout(() => root.querySelector('.gallery__close').focus({ preventScroll: true }), reduced ? 0 : 900);
  }

  function closeGallery({ then, fromPop = false } = {}) {
    if (!open) return;
    if (!fromPop && history.state?.gallery) {
      // let the history entry unwind; popstate finishes the job
      pendingThen = then;
      history.back();
      return;
    }
    open = false;
    const col = current;
    gsap.to(root, {
      clipPath: 'inset(0% 0% 100% 0%)', duration: D(1), ease: 'expo.inOut',
      onComplete: () => {
        root.hidden = true;
        lenis?.destroy(); lenis = null;
        io?.disconnect();
        body.classList.remove('is-gallery');
        if (location.hash.endsWith('/collection')) history.replaceState(null, '', `#${col.id}`);
        if (!document.querySelector('.is-menu')) body.classList.remove('is-overlay');
        if (then) then();
        else if (chapters.index !== col.chapter) chapters.go(col.chapter);
        else document.querySelector(`[data-gallery="${col.id}"]`)?.focus({ preventScroll: true });
      },
    });
  }
  let pendingThen = null;

  window.addEventListener('popstate', () => {
    if (open && !history.state?.gallery) {
      const then = pendingThen; pendingThen = null;
      closeGallery({ then, fromPop: true });
    } else if (!open && history.state?.gallery) {
      openGallery(history.state.gallery, { push: false });
    }
  });

  function switchTo(id) {
    const col = COLLECTIONS.find((c) => c.id === id);
    if (!col) return;
    history.replaceState({ gallery: id }, '', `#${id}/collection`);
    gsap.to(content, {
      opacity: 0, y: -30, duration: D(0.5), ease: 'power2.in',
      onComplete: () => {
        render(col);
        lenis?.scrollTo(0, { immediate: true }); scroller.scrollTop = 0;
        gsap.fromTo(content, { opacity: 0, y: 0 }, { opacity: 1, duration: D(0.4) });
        headIn(0);
      },
    });
  }

  /* ---------- Events ---------- */
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-gallery]');
    if (trigger) { e.preventDefault(); openGallery(trigger.dataset.gallery); return; }
    // clicking a chapter's main photograph opens that collection too
    const cover = e.target.closest('.chapter--work .frame--main');
    const cta = cover?.closest('.chapter')?.querySelector('[data-gallery]');
    if (cta) openGallery(cta.dataset.gallery);
  });
  root.querySelector('.gallery__close').addEventListener('click', () => closeGallery());
  $('next').addEventListener('click', (e) => { e.preventDefault(); switchTo(e.currentTarget.dataset.next); });
  $('top').addEventListener('click', () => (lenis ? lenis.scrollTo(0, { duration: 1.6 }) : scroller.scrollTo({ top: 0, behavior: 'smooth' })));
  $('enquire').addEventListener('click', (e) => { e.preventDefault(); closeGallery({ then: () => chapters.go(7) }); });

  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('.g-item');
    if (!btn) return;
    const n = Number(btn.dataset.index);
    lightbox.open({
      photos: current.photos,
      index: n,
      label: current.title,
      thumbFor: (i) => grid.querySelector(`.g-item[data-index="${i}"]`),
      onIndex: (i) => {
        const el = grid.querySelector(`.g-item[data-index="${i}"]`);
        if (el && lenis) lenis.scrollTo(el, { offset: -window.innerHeight * 0.25, immediate: true });
      },
    });
  });

  window.addEventListener('keydown', (e) => {
    if (!open || lightbox.isOpen) return;
    if (e.key === 'Escape') { e.preventDefault(); closeGallery(); }
  });

  return {
    open: openGallery,
    close: closeGallery,
    get isOpen() { return open; },
    /** Open from a deep link like #weddings/collection */
    fromHash() {
      const m = initialHash.match(/^#(\w+)\/collection$/);
      if (m) openGallery(m[1], { push: false });
    },
  };
}
